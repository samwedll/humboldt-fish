/**
 * The "can I fish RIGHT NOW?" evaluator. Pure: receives nowMs explicitly,
 * never reads the clock — so it runs identically in the browser (minute tick),
 * in vitest, and later in the Phase 3 MCP server.
 *
 * Spec: docs/superpowers/specs/2026-06-10-fish-now-design.md
 */
import type { Verdict, LaunchId, Species, NowVerdict, NowData, Check, CheckStatus } from '../types.js';
import { getLaunch, type LaunchProfile } from '../config/launches.js';
import { thresholds } from '../config/thresholds.js';
import { clampReturnByForEbb } from './runLogistics.js';
import { evalAbove, evalAtLeast } from './runSafety.js';
import { parsePointWind } from './parseMarineProse.js';
import { formatPacificTime, toPacificLocalISO, ptLocalIsoToEpochMs } from '../format.js';

/** Buoy obs older than this can't confirm current conditions — affected factors floor at warn. */
export const NOW_BUOY_MAX_AGE_MS = 60 * 60_000;
export const NOW_FOOTER =
  'Verify the bar status and salmon hotline within 2 hours of launch. Conditions can change fast on the North Coast.';

const TRIP_CAP_MS = thresholds.yearOneTripDurationHr * 3_600_000;
const MIN_TRIP_MS = 2 * 3_600_000; // same floor as MIN_TRIP_HOURS in runLogistics
const DAWN_OFFSET_MS = 30 * 60_000; // morning launches open at civil dawn + 30 (runLogistics convention)

interface GateResult {
  ok: boolean;
  returnByMs: number;
  reason?: string;
  doneForToday?: boolean;
}

function temporalGate(tMs: number, nowData: NowData): GateResult {
  const { dawnMs, duskMs, tidalCurrents } = nowData;
  let returnByMs = Math.min(tMs + TRIP_CAP_MS, duskMs);

  if (tMs < dawnMs + DAWN_OFFSET_MS) {
    return {
      ok: false,
      returnByMs,
      reason: `before first light — earliest launch ${formatPacificTime(new Date(dawnMs + DAWN_OFFSET_MS))}`
    };
  }
  if (duskMs - tMs < MIN_TRIP_MS) {
    return {
      ok: false,
      returnByMs,
      doneForToday: true,
      reason: `under 2 h of usable daylight before civil dusk ${formatPacificTime(new Date(duskMs))}`
    };
  }
  if (tidalCurrents) {
    const launchIso = toPacificLocalISO(new Date(tMs));
    const returnIso = toPacificLocalISO(new Date(returnByMs));
    // Reuses the canonical ebb model: hostile-ebb launch and under-2h clamps
    // both come back as `suppressed` with a human-readable reason.
    const clamp = clampReturnByForEbb(launchIso, returnIso, tidalCurrents);
    if (clamp.suppressed) return { ok: false, returnByMs, reason: clamp.reason };
    if (clamp.newEnd !== returnIso) returnByMs = ptLocalIsoToEpochMs(clamp.newEnd);
  }
  return { ok: true, returnByMs };
}

/**
 * Earliest start after nowMs (today only) where the temporal gates pass.
 * Candidates: dawn+30 and every slack/flood event before the last viable
 * start of the day. Conditions don't move on a schedule, so only temporal
 * candidates are scanned.
 */
function nextViableStart(nowMs: number, nowData: NowData): number | null {
  const candidates: number[] = [];
  const dawnLaunch = nowData.dawnMs + DAWN_OFFSET_MS;
  if (dawnLaunch > nowMs) candidates.push(dawnLaunch);
  if (nowData.tidalCurrents) {
    for (const e of nowData.tidalCurrents.events) {
      if (e.type !== 'slack' && e.type !== 'flood') continue;
      const t = ptLocalIsoToEpochMs(e.time);
      if (t > nowMs && t <= nowData.duskMs - MIN_TRIP_MS) candidates.push(t);
    }
  }
  candidates.sort((a, b) => a - b);
  for (const t of candidates) {
    if (temporalGate(t, nowData).ok) return t;
  }
  return null;
}

// ---- Condition factor helpers ----

const SEVERITY: Record<CheckStatus, number> = { pass: 0, unknown: 0, warn: 1, fail: 2 };

function formatAge(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/** Floor a factor at warn (stale data can't confirm a pass) without masking a fail. */
function floorAtWarn(f: Check, ageNote: string): Check {
  if (SEVERITY[f.status] >= SEVERITY.warn) {
    return { ...f, note: f.note ? `${f.note}; ${ageNote}` : ageNote };
  }
  return { ...f, status: 'warn', note: ageNote };
}

function angularDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function buoyFactors(
  tMs: number,
  nowData: NowData,
  profile: LaunchProfile
): { factors: Check[]; obsAgeMs: number | null; degraded: boolean } {
  if (!profile.openOcean || !profile.requiresSwellCheck) {
    return { factors: [], obsAgeMs: null, degraded: false };
  }
  const buoy = nowData.buoy;
  if (!buoy) {
    // Mirrors the day pipeline's hard rule: today's open-ocean verdict REQUIRES
    // a live buoy. For an immediate launch, can't-verify means don't launch.
    return {
      factors: [
        {
          layer: 'safety',
          name: 'Live buoy',
          value: 'unavailable',
          threshold: 'required for an open-ocean launch right now',
          status: 'fail',
          note: 'Verify directly via NDBC station 46244 or the USCG bar advisory before launching.'
        }
      ],
      obsAgeMs: null,
      degraded: false
    };
  }

  const factors: Check[] = [];
  if (buoy.waveHtFt !== null) {
    factors.push({
      layer: 'safety',
      name: 'Swell height',
      value: `${buoy.waveHtFt.toFixed(1)} ft`,
      threshold: `≤ ${thresholds.swellHeightFt} ft`,
      status: evalAbove(buoy.waveHtFt, thresholds.swellHeightFt)
    });
  }
  if (buoy.dominantPeriodSec !== null) {
    factors.push({
      layer: 'safety',
      name: 'Swell period',
      value: `${buoy.dominantPeriodSec.toFixed(1)} s`,
      threshold: `≥ ${thresholds.swellPeriodSec} s`,
      status: evalAtLeast(buoy.dominantPeriodSec, thresholds.swellPeriodSec)
    });
  }
  // 46244 is wave-only, so wind/alignment from the buoy are usually null —
  // guard exactly like runSafetyFromBuoy. Wind itself comes from the point
  // forecast (windFactor); gusts aren't reported by 46244 at all.
  if (profile.requiresAlignmentCheck && buoy.windDirDeg !== null && buoy.meanWaveDirDeg !== null) {
    const diff = angularDiffDeg(buoy.windDirDeg, buoy.meanWaveDirDeg);
    factors.push({
      layer: 'safety',
      name: 'Wind/swell alignment',
      value: `${diff.toFixed(0)}°`,
      threshold: `≤ ${thresholds.windSwellAlignmentDeg}° apart`,
      status: evalAbove(diff, thresholds.windSwellAlignmentDeg)
    });
  }

  const obsAgeMs = tMs - buoy.observedAtMs;
  const degraded = obsAgeMs > NOW_BUOY_MAX_AGE_MS;
  if (degraded) {
    const ageNote = `can't confirm current conditions — buoy data ${formatAge(obsAgeMs)} old`;
    return { factors: factors.map((f) => floorAtWarn(f, ageNote)), obsAgeMs, degraded };
  }
  return { factors, obsAgeMs, degraded };
}

function windFactor(
  tMs: number,
  returnByMs: number,
  nowData: NowData,
  profile: LaunchProfile,
  day: Verdict
): Check | null {
  if (!profile.requiresWindCheck) return null;
  const overlapping = (nowData.pointPeriods ?? []).filter(
    (p) => p.startMs < returnByMs && p.endMs > tMs
  );
  let bestHigh: number | undefined;
  let valueLabel = '';
  for (const p of overlapping) {
    const w = parsePointWind(p.windSpeed, p.windDirection);
    if (w.highKt !== undefined && (bestHigh === undefined || w.highKt > bestHigh)) {
      bestHigh = w.highKt;
      valueLabel =
        w.lowKt !== undefined && w.lowKt !== w.highKt
          ? `${w.lowKt.toFixed(0)}-${w.highKt.toFixed(0)} kt ${w.dirAbbr ?? ''}`.trim()
          : `${w.highKt.toFixed(0)} kt ${w.dirAbbr ?? ''}`.trim();
    }
  }
  if (bestHigh !== undefined) {
    return {
      layer: 'safety',
      name: 'Sustained wind',
      value: valueLabel,
      threshold: `≤ ${thresholds.windSustainedTripKt} kt`,
      status: evalAbove(bestHigh, thresholds.windSustainedTripKt),
      note: 'NWS point forecast — worst period overlapping the trip span'
    };
  }
  // No period covers the span — never silently more optimistic: reuse the
  // day verdict's wind check and say so, or surface an explicit warn.
  const dayWind = day.checks.find((c) => c.name === 'Sustained wind');
  if (dayWind) {
    return {
      ...dayWind,
      note: `${dayWind.note ? `${dayWind.note}; ` : ''}whole-day forecast — no point period covers the trip span`
    };
  }
  return {
    layer: 'safety',
    name: 'Sustained wind',
    value: 'unverified',
    threshold: `≤ ${thresholds.windSustainedTripKt} kt`,
    status: 'warn',
    note: 'No wind source covers the trip span — verify before launching'
  };
}

export function evaluateNow(
  nowMs: number,
  day: Verdict,
  ctx: { launch: LaunchId; species: Species }
): NowVerdict | null {
  const nowData = day.nowData;
  if (!nowData) return null;
  // Past-midnight guard: payload computed for a previous PT date.
  // Caller shows a "refresh" notice instead of computing nonsense.
  if (toPacificLocalISO(new Date(nowMs)).slice(0, 10) !== nowData.date) return null;

  const profile = getLaunch(ctx.launch);
  const baseStaleness = {
    obsAgeMs: nowData.buoy ? nowMs - nowData.buoy.observedAtMs : null,
    degraded: false
  };

  // Layer 1 carries over unchanged — legality is date-based, not time-of-day-based.
  if (day.layers.legal.status === 'fail') {
    return {
      verdict: 'NO-GO',
      reason: day.layers.legal.summary,
      factors: [],
      checklist: [],
      staleness: baseStaleness
    };
  }

  // For an immediate launch at a currents launch, can't-verify means don't
  // launch: with no live currents data the tide gate — the safety check at
  // these launches — would silently vanish. (The day pipeline may still plan
  // around tide tables; the now-verdict can't.)
  if (profile.currentStation && !(nowData.tidalCurrents && nowData.tidalCurrents.events.length > 0)) {
    return {
      verdict: 'NO-GO',
      reason: 'Cannot verify tide phase — live currents data unavailable. Check NOAA tide tables before launching.',
      factors: [],
      checklist: [],
      staleness: baseStaleness
    };
  }

  const conditionsAt = (tMs: number, returnByMs: number) => {
    const b = buoyFactors(tMs, nowData, profile);
    const factors = [...b.factors];
    const w = windFactor(tMs, returnByMs, nowData, profile, day);
    if (w) factors.push(w);
    return { factors, obsAgeMs: b.obsAgeMs, degraded: b.degraded };
  };

  const gate = temporalGate(nowMs, nowData);
  if (!gate.ok) {
    let nextViableAtMs: number | undefined;
    // `next` tracks whether the temporal scan found any candidate at all.
    // When the scan is empty (next === null) the blocker is genuinely terminal
    // for today. When the scan found a candidate but conditions fail there, the
    // user still has a temporal window — just not a clean one — so we keep the
    // "Not now" framing rather than the terminal "Done for today" suffix.
    let next: number | null = null;
    if (!gate.doneForToday) {
      next = nextViableStart(nowMs, nowData);
      if (next !== null) {
        // "Viable from 14:10" must not point into failing conditions.
        const nextGate = temporalGate(next, nowData);
        const cond = conditionsAt(next, nextGate.returnByMs);
        if (!cond.factors.some((f) => f.status === 'fail')) nextViableAtMs = next;
      }
    }
    return {
      verdict: 'NO-GO',
      reason: gate.doneForToday
        ? `Done for today — ${gate.reason}`
        : nextViableAtMs !== undefined
          ? `Not now — ${gate.reason}`
          : next === null
            ? `Done for today — ${gate.reason}; no viable start remains before dusk`
            : `Not now — ${gate.reason}`,
      ...(nextViableAtMs !== undefined ? { nextViableAtMs } : {}),
      factors: [],
      checklist: [],
      staleness: baseStaleness
    };
  }

  const { factors, obsAgeMs, degraded } = conditionsAt(nowMs, gate.returnByMs);
  const staleness = { obsAgeMs, degraded };
  const fails = factors.filter((f) => f.status === 'fail');
  const warns = factors.filter((f) => f.status === 'warn');

  if (fails.length > 0) {
    return {
      verdict: 'NO-GO',
      reason: fails.map((f) => `${f.name} ${f.value}`).join(', '),
      factors,
      checklist: [],
      staleness
    };
  }

  if (warns.length >= 2) {
    return {
      verdict: 'CONDITIONAL',
      reason: warns.map((f) => `${f.name} ${f.value}`).join(', '),
      returnByMs: gate.returnByMs,
      factors,
      checklist: [],
      staleness
    };
  }

  return {
    verdict: 'GO',
    reason: 'Conditions verified for an immediate launch',
    returnByMs: gate.returnByMs,
    factors,
    checklist: [],
    staleness
  };
}
