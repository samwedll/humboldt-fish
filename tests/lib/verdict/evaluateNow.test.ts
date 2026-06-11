import { describe, it, expect } from 'vitest';
import { evaluateNow } from '../../../src/lib/verdict/evaluateNow.js';
import type { Verdict, NowData, TidalCurrentEvent } from '../../../src/lib/types.js';

// June 2026 is PDT (UTC-7): "HH:MM PT" === "HH:MM-07:00".
const PT = (hhmm: string, date = '2026-06-10') => Date.parse(`${date}T${hhmm}:00-07:00`);

const DAWN = PT('05:00');
const DUSK = PT('21:00');

function ev(time: string, type: TidalCurrentEvent['type'], velocityKt: number): TidalCurrentEvent {
  return { time, type, velocityKt, meanFloodDirDeg: 30, meanEbbDirDeg: 210 };
}

function dayVerdict(nowData?: NowData): Verdict {
  return {
    date: '2026-06-10',
    verdict: 'GO',
    reason: 'All four layers pass',
    layers: {
      legal: { status: 'pass', summary: 'open' },
      safety: { status: 'pass', summary: 'ok' },
      quality: { status: 'pass', summary: 'ok' },
      logistics: { status: 'pass', summary: 'ok' }
    },
    checks: [],
    recommendations: {},
    dataSources: { buoy: 'live', nwsZone: 'live', nwsPoint: 'live', currents: 'not-applicable' },
    ...(nowData ? { nowData } : {})
  };
}

const ALL_DAY_CALM = [
  { startMs: PT('06:00'), endMs: PT('18:00'), windSpeed: '5 to 10 mph', windDirection: 'NW' },
  { startMs: PT('18:00'), endMs: PT('06:00', '2026-06-11'), windSpeed: '5 to 10 mph', windDirection: 'NW' }
];

function trinidadNowData(overrides: Partial<NowData> = {}): NowData {
  return {
    date: '2026-06-10',
    dawnMs: DAWN,
    duskMs: DUSK,
    buoy: {
      observedAt: new Date(PT('13:50')).toISOString(),
      observedAtMs: PT('13:50'),
      windKt: null, gustKt: null, windDirDeg: null,
      waveHtFt: 3.2, dominantPeriodSec: 12, meanWaveDirDeg: null, waterTempF: 52
    },
    pointPeriods: ALL_DAY_CALM,
    ...overrides
  };
}

function bayNowData(events: TidalCurrentEvent[]): NowData {
  return {
    date: '2026-06-10',
    dawnMs: DAWN,
    duskMs: DUSK,
    tidalCurrents: { station: 'HUB0203', units: 'knots', events },
    pointPeriods: ALL_DAY_CALM
  };
}

const TRINIDAD = { launch: 'trinidad', species: 'rockfish' } as const;
const BAY = { launch: 'humboldt-bay-interior', species: 'surfperch' } as const;

describe('evaluateNow — guards', () => {
  it('returns null when the day has no nowData', () => {
    expect(evaluateNow(PT('14:00'), dayVerdict(), TRINIDAD)).toBeNull();
  });

  it('returns null after midnight rollover (nowMs date != payload date)', () => {
    const r = evaluateNow(PT('01:00', '2026-06-11'), dayVerdict(trinidadNowData()), TRINIDAD);
    expect(r).toBeNull();
  });

  it('carries a legal failure straight through', () => {
    const day = dayVerdict(trinidadNowData());
    day.layers.legal = { status: 'fail', summary: 'Season closed' };
    const r = evaluateNow(PT('14:00'), day, TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toBe('Season closed');
  });
});

describe('evaluateNow — temporal gates', () => {
  it('pre-dawn: NO-GO with next viable at dawn+30', () => {
    const nd = trinidadNowData({
      buoy: { ...trinidadNowData().buoy!, observedAt: new Date(PT('04:20')).toISOString(), observedAtMs: PT('04:20') }
    });
    const r = evaluateNow(PT('04:30'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/^Not now — before first light/);
    expect(r.nextViableAtMs).toBe(DAWN + 30 * 60_000);
  });

  it('under 2h of daylight left: done for today, no nextViableAtMs', () => {
    const r = evaluateNow(PT('19:30'), dayVerdict(trinidadNowData()), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/^Done for today/);
    expect(r.nextViableAtMs).toBeUndefined();
  });

  it('mid-ebb at a currents launch: NO-GO now, viable from the next slack', () => {
    // slack 12:00 → ebb peaks 15:00 at 2.5 kt → slack 18:00 → flood 20:00.
    // At 14:00 the sinusoidal model gives 2.5·sin(π/2·⅔) ≈ 2.17 kt — hostile.
    const nd = bayNowData([
      ev('2026-06-10T12:00', 'slack', 0),
      ev('2026-06-10T15:00', 'ebb', -2.5),
      ev('2026-06-10T18:00', 'slack', 0),
      ev('2026-06-10T20:00', 'flood', 2.0)
    ]);
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), BAY)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/^Not now/);
    expect(r.nextViableAtMs).toBe(PT('18:00'));
  });

  it('ebb clamp shortens returnBy on a viable launch', () => {
    // slack 12:00 → ebb peaks 16:00 at 2.5 kt. Launch 11:00 (before the slack),
    // returnBy capped at 15:00 (4h). Crossing of 1.5 kt on the rising side:
    // frac = (2/π)·asin(1.5/2.5) ≈ 0.40966 → floor(12:00 + 240·0.40966 min) =
    // 13:38; minus the 15 min buffer → returnBy 13:23 (still ≥ 2h after launch).
    const nd = bayNowData([
      ev('2026-06-10T12:00', 'slack', 0),
      ev('2026-06-10T16:00', 'ebb', -2.5)
    ]);
    const r = evaluateNow(PT('11:00'), dayVerdict(nd), BAY)!;
    expect(r.verdict).toBe('GO');
    expect(r.returnByMs).toBe(PT('13:23'));
  });

  it('plain viable afternoon at Trinidad: GO with returnBy = now + 4h', () => {
    const r = evaluateNow(PT('14:00'), dayVerdict(trinidadNowData()), TRINIDAD)!;
    expect(r.verdict).toBe('GO');
    expect(r.returnByMs).toBe(PT('18:00'));
  });

  it('late start: returnBy capped at civil dusk, not now + 4h', () => {
    // 17:30 + 4h would be 21:30; dusk is 21:00 → min() picks dusk.
    // Still viable: 3.5h of daylight ≥ the 2h minimum.
    const r = evaluateNow(PT('17:30'), dayVerdict(trinidadNowData()), TRINIDAD)!;
    expect(r.verdict).toBe('GO');
    expect(r.returnByMs).toBe(DUSK);
  });
});
