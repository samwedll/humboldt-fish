/**
 * The "can I fish RIGHT NOW?" evaluator. Pure: receives nowMs explicitly,
 * never reads the clock — so it runs identically in the browser (minute tick),
 * in vitest, and later in the Phase 3 MCP server.
 *
 * Spec: docs/superpowers/specs/2026-06-10-fish-now-design.md
 */
import type { Verdict, LaunchId, Species, NowVerdict, NowData, Check } from '../types.js';
import { getLaunch } from '../config/launches.js';
import { thresholds } from '../config/thresholds.js';
import { clampReturnByForEbb } from './runLogistics.js';
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

  const gate = temporalGate(nowMs, nowData);
  if (!gate.ok) {
    let nextViableAtMs: number | undefined;
    if (!gate.doneForToday) {
      const next = nextViableStart(nowMs, nowData);
      if (next !== null) nextViableAtMs = next; // Task 7 adds: only if conditions pass at `next`
    }
    return {
      verdict: 'NO-GO',
      reason: gate.doneForToday ? `Done for today — ${gate.reason}` : `Not now — ${gate.reason}`,
      ...(nextViableAtMs !== undefined ? { nextViableAtMs } : {}),
      factors: [],
      checklist: [],
      staleness: baseStaleness
    };
  }

  // ---- Conditions (Tasks 7–8 replace this stub) ----
  const factors: Check[] = [];

  return {
    verdict: 'GO',
    reason: 'Conditions verified for an immediate launch',
    returnByMs: gate.returnByMs,
    factors,
    checklist: [],
    staleness: baseStaleness
  };
}
