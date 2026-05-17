import type {
  Verdict,
  FetchedData,
  Species,
  LaunchId,
  LayerName,
  LayerResult,
  Check
} from '../types.js';
import { runLegal } from './runLegal.js';
import { runSafety } from './runSafety.js';
import { runQuality } from './runQuality.js';
import { runLogistics } from './runLogistics.js';

export interface ComputeInput {
  date: string;
  species: Species;
  launch: LaunchId;
  data: FetchedData;
}

const NOT_RUN: LayerResult = {
  status: 'incomplete',
  summary: 'Not evaluated (earlier layer failed)'
};

export function computeVerdict({ date, species, launch, data }: ComputeInput): Verdict {
  const checks: Check[] = [];
  const layers: Record<LayerName, LayerResult> = {
    legal: NOT_RUN,
    safety: NOT_RUN,
    quality: NOT_RUN,
    logistics: NOT_RUN
  };

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
      recommendations: {}
    };
  }

  const safety = runSafety({ date, launch, data });
  layers.safety = safety.result;
  checks.push(...safety.checks);
  if (safety.result.status === 'fail') {
    return {
      date,
      verdict: 'NO-GO',
      reason: safety.result.summary,
      layers,
      checks,
      recommendations: {}
    };
  }
  if (safety.result.status === 'incomplete') {
    return {
      date,
      verdict: 'INCOMPLETE',
      reason: safety.result.summary,
      layers,
      checks,
      recommendations: {}
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
      }
    };
  }

  return {
    date,
    verdict: 'GO',
    reason: 'All four layers pass',
    layers,
    checks,
    recommendations: logistics.recommendations
  };
}
