import type {
  FetchedData,
  LayerResult,
  Check,
  CheckStatus,
  LaunchId,
  NwsZoneForecast,
  NwsZonePeriod,
  NdbcObservation
} from '../types.js';
import { thresholds, WARN_BAND } from '../config/thresholds.js';
import { parseMarineProse, deriveDateForPeriod, parsePointWind, findPointPeriodForDate } from './parseMarineProse.js';
import { getLaunch, type LaunchProfile } from '../config/launches.js';

export interface SafetyInput {
  date: string;     // YYYY-MM-DD Pacific — the verdict date
  today?: string;   // YYYY-MM-DD Pacific — today, used to gate "live buoy required" rule.
                    // Defaults to a sentinel that never matches a real date so the gate is opt-in.
  launch: LaunchId;
  data: FetchedData;
}
export interface SafetyOutput {
  result: LayerResult;
  checks: Check[];
}

export function evalAbove(value: number, failAt: number): CheckStatus {
  if (value > failAt) return 'fail';
  if (value >= failAt * (1 - WARN_BAND)) return 'warn';
  return 'pass';
}

export function evalAtLeast(value: number, failBelow: number): CheckStatus {
  if (value < failBelow) return 'fail';
  if (value < failBelow * (1 + WARN_BAND)) return 'warn';
  return 'pass';
}

function angularDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function ndbcDatePacific(observedAt: string): string {
  // observedAt is UTC ISO. Return YYYY-MM-DD in Pacific (LA) time.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(observedAt));
}

function findNwsPeriodForDate(
  nws: NwsZoneForecast,
  date: string
): { period: NwsZonePeriod; index: number } | null {
  for (let i = 0; i < nws.periods.length; i++) {
    const r = deriveDateForPeriod(i, nws.updated);
    if (r.date === date && r.isDaytime) {
      return { period: nws.periods[i], index: i };
    }
  }
  return null;
}

/**
 * Wind from the NWS point forecast for this launch's coordinates, if available.
 * Point forecast is location-aware (handles topographic sheltering), so we use
 * it as the primary wind source for ALL launches. Buoy 46244 has no wind
 * (wave-only buoy); 46022 is offshore and overstates sheltered-water wind.
 */
/**
 * Lagoon spit advisory: for launches whose sandbar can breach (Big Lagoon,
 * Stone Lagoon), surface a `status: 'unknown'` check reminding the paddler
 * to verify the spit visually. The Safety layer's other checks still drive
 * the verdict; this just makes the hazard explicit. Returns null when the
 * launch has no ocean-facing spit (Trinidad, Freshwater Lagoon, slough, bay).
 */
function spitAdvisory(profile: LaunchProfile): Check | null {
  if (!profile.hasOceanFacingSpit) return null;
  return {
    layer: 'safety',
    name: 'Spit status',
    value: 'verify visually before launch',
    threshold: 'spit closed = Tier-1 closed-water profile applies',
    status: 'unknown',
    note: `When ${profile.label}'s spit is open the safety profile changes substantially: currents through the breach can exceed 3 kt, ocean swell wraps into the lagoon, and the launch is no longer Tier 1. The verdict below assumes a closed spit. Verify visually (or via Humboldt Lagoons State Park advisories) before launching.`
  };
}

function pointWindChecks(
  data: FetchedData,
  date: string,
  profile: LaunchProfile
): Check[] {
  if (!profile.requiresWindCheck || !data.nwsPoint) return [];
  const period = findPointPeriodForDate(data.nwsPoint.periods, date);
  if (!period) return [];
  const w = parsePointWind(period.windSpeed, period.windDirection);
  if (w.highKt === undefined) return [];
  const valueLabel =
    w.lowKt !== undefined && w.lowKt !== w.highKt
      ? `${w.lowKt.toFixed(0)}-${w.highKt.toFixed(0)} kt ${w.dirAbbr ?? ''}`.trim()
      : `${w.highKt.toFixed(0)} kt ${w.dirAbbr ?? ''}`.trim();
  return [
    {
      layer: 'safety',
      name: 'Sustained wind',
      value: valueLabel,
      threshold: `≤ ${thresholds.windSustainedTripKt} kt`,
      status: evalAbove(w.highKt, thresholds.windSustainedTripKt),
      note: `NWS point forecast (${profile.label}), high end of range used`
    }
  ];
}

export function runSafety({ date, today = '0000-00-00', launch, data }: SafetyInput): SafetyOutput {
  const profile = getLaunch(launch);
  const buoy = data.ndbc46244;
  const buoyMatchesDate = buoy && ndbcDatePacific(buoy.observedAt) === date;
  const pointChecks = pointWindChecks(data, date, profile);

  // Hard rule: open-ocean today's verdict REQUIRES live buoy. The whole point
  // of the project is catching the case where forecast says calm but the live
  // buoy reports dangerous conditions. If the buoy is dark, we can't verify —
  // do NOT silently fall back to forecast for today at Trinidad.
  const isToday = date === today;
  if (isToday && profile.openOcean && profile.requiresSwellCheck && !buoy) {
    return {
      result: {
        status: 'incomplete',
        summary: `Live buoy 46244 unavailable — cannot verify open-ocean conditions for ${profile.label} today`
      },
      checks: [
        {
          layer: 'safety',
          name: 'Live buoy',
          value: 'unavailable',
          threshold: 'required for today\'s open-ocean verdict',
          status: 'unknown',
          note: 'Verify directly via NDBC station 46244 or the USCG bar advisory before launching.'
        }
      ]
    };
  }

  // The buoy branch is only useful for open-ocean launches that actually need
  // swell/period/alignment checks against live observed wave data. For
  // protected-water launches (lagoons, slough, bay) the wave-only NDBC 46244
  // can't contribute wind — so we should skip the buoy branch and fall
  // through to the NWS prose path, which incorporates point-forecast wind
  // when available and zone-forecast prose when it isn't.
  if (buoyMatchesDate && buoy && profile.requiresSwellCheck) {
    return runSafetyFromBuoy(buoy, profile, pointChecks);
  }

  // NWS zone forecast prose (CWF text product): primary path for future days
  // and the late-evening today case where the NWS point forecast no longer
  // includes a daytime period for today.
  if (data.nwsZone) {
    const match = findNwsPeriodForDate(data.nwsZone, date);
    if (match) {
      return runSafetyFromNws(match.period.detailedForecast, date, profile, pointChecks);
    }
  }

  // No buoy or zone, but point forecast might still cover wind
  if (pointChecks.length > 0) {
    const spit = spitAdvisory(profile);
    return synthesize(spit ? [spit, ...pointChecks] : pointChecks, 'NWS point forecast');
  }

  return {
    result: {
      status: 'incomplete',
      summary: 'No buoy, NWS zone, or point forecast available for this date'
    },
    checks: [
      {
        layer: 'safety',
        name: 'Data',
        value: 'unavailable',
        threshold: 'NDBC for today, NWS zone or point forecast otherwise',
        status: 'unknown'
      }
    ]
  };
}

function runSafetyFromBuoy(
  buoy: NdbcObservation,
  profile: LaunchProfile,
  pointChecks: Check[]
): SafetyOutput {
  const spit = spitAdvisory(profile);
  const checks: Check[] = spit ? [spit, ...pointChecks] : [...pointChecks];
  // Buoy wind is only used if point forecast didn't supply it (e.g., fallback).
  // NDBC 46244 has no wind anyway — wave-only buoy.
  const hasPointWind = pointChecks.some((c) => c.name === 'Sustained wind');
  if (profile.requiresWindCheck && !hasPointWind && buoy.windKt !== null) {
    checks.push({
      layer: 'safety',
      name: 'Sustained wind',
      value: `${buoy.windKt.toFixed(1)} kt`,
      threshold: `≤ ${thresholds.windSustainedTripKt} kt`,
      status: evalAbove(buoy.windKt, thresholds.windSustainedTripKt)
    });
  }
  if (profile.requiresWindCheck && buoy.gustKt !== null) {
    checks.push({
      layer: 'safety',
      name: 'Wind gust',
      value: `${buoy.gustKt.toFixed(1)} kt`,
      threshold: `≤ ${thresholds.windGustKt} kt`,
      status: evalAbove(buoy.gustKt, thresholds.windGustKt)
    });
  }
  if (profile.requiresSwellCheck && buoy.waveHtFt !== null) {
    checks.push({
      layer: 'safety',
      name: 'Swell height',
      value: `${buoy.waveHtFt.toFixed(1)} ft`,
      threshold: `≤ ${thresholds.swellHeightFt} ft`,
      status: evalAbove(buoy.waveHtFt, thresholds.swellHeightFt)
    });
  }
  if (profile.requiresPeriodCheck && buoy.dominantPeriodSec !== null) {
    checks.push({
      layer: 'safety',
      name: 'Swell period',
      value: `${buoy.dominantPeriodSec.toFixed(1)} s`,
      threshold: `≥ ${thresholds.swellPeriodSec} s`,
      status: evalAtLeast(buoy.dominantPeriodSec, thresholds.swellPeriodSec)
    });
  }
  if (
    profile.requiresAlignmentCheck &&
    buoy.windDirDeg !== null &&
    buoy.meanWaveDirDeg !== null
  ) {
    const diff = angularDiffDeg(buoy.windDirDeg, buoy.meanWaveDirDeg);
    const s: CheckStatus =
      diff > thresholds.windSwellAlignmentDeg
        ? 'fail'
        : diff > thresholds.windSwellAlignmentDeg * (1 - WARN_BAND)
          ? 'warn'
          : 'pass';
    checks.push({
      layer: 'safety',
      name: 'Wind/swell alignment',
      value: `${diff.toFixed(0)}°`,
      threshold: `≤ ${thresholds.windSwellAlignmentDeg}° apart`,
      status: s
    });
  }
  if (profile.openOcean && buoy.waterTempF !== null) {
    checks.push({
      layer: 'safety',
      name: 'Water temp',
      value: `${buoy.waterTempF.toFixed(1)} °F`,
      threshold: 'Tempest layering required (always in Humboldt)',
      status: 'pass',
      note: 'Always required regardless of temp.'
    });
  }
  if (checks.length === 0) {
    return {
      result: { status: 'incomplete', summary: 'No applicable buoy data for this launch' },
      checks: [
        {
          layer: 'safety',
          name: 'Data',
          value: 'unavailable',
          threshold: 'wind data needed',
          status: 'unknown'
        }
      ]
    };
  }
  return synthesize(checks, 'Buoy 46244');
}

function runSafetyFromNws(
  text: string,
  date: string,
  profile: LaunchProfile,
  pointChecks: Check[]
): SafetyOutput {
  const p = parseMarineProse(text);
  const spit = spitAdvisory(profile);
  const checks: Check[] = spit ? [spit, ...pointChecks] : [...pointChecks];
  const hasPointWind = pointChecks.some((c) => c.name === 'Sustained wind');
  if (profile.requiresWindCheck && !hasPointWind && p.windHighKt !== undefined) {
    checks.push({
      layer: 'safety',
      name: 'Sustained wind',
      value:
        p.windLowKt !== p.windHighKt ? `${p.windLowKt}-${p.windHighKt} kt` : `${p.windHighKt} kt`,
      threshold: `≤ ${thresholds.windSustainedTripKt} kt`,
      status: evalAbove(p.windHighKt, thresholds.windSustainedTripKt),
      note: 'NWS forecast, high-end of range used'
    });
  }
  if (profile.requiresWindCheck && p.gustKt !== undefined) {
    checks.push({
      layer: 'safety',
      name: 'Wind gust',
      value: `${p.gustKt} kt`,
      threshold: `≤ ${thresholds.windGustKt} kt`,
      status: evalAbove(p.gustKt, thresholds.windGustKt)
    });
  }
  if (profile.requiresSwellCheck && p.seasFt !== undefined) {
    checks.push({
      layer: 'safety',
      name: 'Swell height',
      value: `${p.seasFt} ft`,
      threshold: `≤ ${thresholds.swellHeightFt} ft`,
      status: evalAbove(p.seasFt, thresholds.swellHeightFt),
      note: 'NWS Seas (combined sea state)'
    });
  }
  if (profile.requiresPeriodCheck && p.swellPeriodSec !== undefined) {
    checks.push({
      layer: 'safety',
      name: 'Swell period',
      value: `${p.swellPeriodSec} s`,
      threshold: `≥ ${thresholds.swellPeriodSec} s`,
      status: evalAtLeast(p.swellPeriodSec, thresholds.swellPeriodSec)
    });
  }
  if (
    profile.requiresAlignmentCheck &&
    p.windDirDeg !== undefined &&
    p.swellDirDeg !== undefined
  ) {
    const diff = angularDiffDeg(p.windDirDeg, p.swellDirDeg);
    const s: CheckStatus =
      diff > thresholds.windSwellAlignmentDeg
        ? 'fail'
        : diff > thresholds.windSwellAlignmentDeg * (1 - WARN_BAND)
          ? 'warn'
          : 'pass';
    checks.push({
      layer: 'safety',
      name: 'Wind/swell alignment',
      value: `${diff.toFixed(0)}°`,
      threshold: `≤ ${thresholds.windSwellAlignmentDeg}° apart`,
      status: s
    });
  }
  if (checks.length === 0) {
    return {
      result: {
        status: 'incomplete',
        summary: `NWS forecast for ${date} could not be parsed`
      },
      checks: [
        {
          layer: 'safety',
          name: 'NWS prose',
          value: 'unparsable',
          threshold: 'wind + seas + period needed',
          status: 'unknown',
          note: text.slice(0, 100)
        }
      ]
    };
  }
  return synthesize(checks, 'NWS PZZ450 forecast');
}

function synthesize(checks: Check[], sourceLabel: string): SafetyOutput {
  const fails = checks.filter((c) => c.status === 'fail');
  const warns = checks.filter((c) => c.status === 'warn');
  if (fails.length > 0) {
    return {
      result: {
        status: 'fail',
        summary: fails.map((c) => `${c.name} ${c.value}`).join(', ')
      },
      checks
    };
  }
  if (warns.length >= 1) {
    return {
      result: {
        status: 'warn',
        summary: warns.map((c) => `${c.name} ${c.value}`).join(', ')
      },
      checks
    };
  }
  return {
    result: { status: 'pass', summary: `All thresholds met (${sourceLabel})` },
    checks
  };
}
