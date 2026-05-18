import type {
  Verdict,
  FetchedData,
  Species,
  LaunchId,
  LayerName,
  LayerResult,
  Check,
  DataSources,
  SourcePresence
} from '../types.js';
import { runLegal } from './runLegal.js';
import { runSafety } from './runSafety.js';
import { runQuality } from './runQuality.js';
import { runLogistics } from './runLogistics.js';
import { getLaunch } from '../config/launches.js';
import { findPointPeriodForDate } from './parseMarineProse.js';

export interface ComputeInput {
  date: string;
  today?: string; // YYYY-MM-DD Pacific — today, used by the open-ocean live-buoy gate.
                  // Optional so unit tests don't have to set it; the orchestrator always supplies it.
  species: Species;
  launch: LaunchId;
  data: FetchedData;
}

const NOT_RUN: LayerResult = {
  status: 'incomplete',
  summary: 'Not evaluated (earlier layer failed)'
};

function buoyDatePacific(observedAt: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(observedAt));
}

/**
 * Snapshot of which sources contributed (or could have contributed) for this
 * specific verdict day. Renders as a small "Verdict from: ..." chip on the
 * DayCard so silent fallbacks are visible to the user.
 */
function summarizeDataSources({
  date,
  today,
  launch,
  data
}: ComputeInput): DataSources {
  const profile = getLaunch(launch);
  const isToday = date === today;

  // Buoy only "applies" to today's date — for future days we never expected it.
  let buoy: SourcePresence;
  if (!isToday || !profile.openOcean) {
    buoy = 'not-applicable';
  } else {
    const b = data.ndbc46244;
    buoy = b && buoyDatePacific(b.observedAt) === date ? 'live' : 'missing';
  }

  // NWS zone forecast applies to future days at open-ocean launches; useful as
  // fallback context elsewhere.
  const nwsZone: SourcePresence = data.nwsZone ? 'live' : 'missing';

  // Point forecast is the wind source everywhere.
  const point = data.nwsPoint;
  let nwsPoint: SourcePresence;
  if (!point) {
    nwsPoint = 'missing';
  } else {
    nwsPoint = findPointPeriodForDate(point.periods, date) ? 'live' : 'missing';
  }

  // Tidal currents only "apply" to launches with a currentStation set
  // (slough + bay interior). Trinidad / lagoons: not-applicable.
  let currents: SourcePresence;
  if (!profile.currentStation) {
    currents = 'not-applicable';
  } else {
    currents = data.tidalCurrents ? 'live' : 'missing';
  }

  return { buoy, nwsZone, nwsPoint, currents };
}

export function computeVerdict(input: ComputeInput): Verdict {
  const { date, today = '0000-00-00', species, launch, data } = input;
  const checks: Check[] = [];
  const layers: Record<LayerName, LayerResult> = {
    legal: NOT_RUN,
    safety: NOT_RUN,
    quality: NOT_RUN,
    logistics: NOT_RUN
  };
  const dataSources = summarizeDataSources(input);

  const legal = runLegal({ species, launch, date });
  layers.legal = legal.result;
  checks.push(...legal.checks);
  if (legal.result.status === 'fail') {
    return {
      date,
      verdict: 'NO-GO',
      reason: legal.result.summary,
      layers,
      checks,
      recommendations: {},
      dataSources
    };
  }

  const safety = runSafety({ date, today, launch, data });
  layers.safety = safety.result;
  checks.push(...safety.checks);
  if (safety.result.status === 'fail') {
    return {
      date,
      verdict: 'NO-GO',
      reason: safety.result.summary,
      layers,
      checks,
      recommendations: {},
      dataSources
    };
  }
  if (safety.result.status === 'incomplete') {
    return {
      date,
      verdict: 'INCOMPLETE',
      reason: safety.result.summary,
      layers,
      checks,
      recommendations: {},
      dataSources
    };
  }

  const quality = runQuality({ species, date, data });
  layers.quality = quality.result;
  checks.push(...quality.checks);

  const logistics = runLogistics({ species, date, launch, data });
  layers.logistics = logistics.result;
  checks.push(...logistics.checks);

  const safetyWarns = safety.checks.filter((c) => c.status === 'warn').length;
  if (safetyWarns >= 2) {
    return {
      date,
      verdict: 'CONDITIONAL',
      reason: safety.result.summary,
      layers,
      checks,
      recommendations: {
        ...logistics.recommendations,
        bailout:
          'If conditions degrade en route (wind builds, period drops, fog rolls in), turn back to Trinidad ramp. Don’t commit beyond the harbor mouth on a CONDITIONAL day.'
      },
      dataSources
    };
  }

  return {
    date,
    verdict: 'GO',
    reason: 'All four layers pass',
    layers,
    checks,
    recommendations: logistics.recommendations,
    dataSources
  };
}
