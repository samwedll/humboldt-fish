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
    // Fresh buoy at 17:20 (10 min old) — this test checks the temporal gate,
    // not staleness; the default fixture (buoy at 13:50) would be 3h 40min stale
    // at 17:30 and degrade to CONDITIONAL, obscuring what we're actually testing.
    const nd = trinidadNowData({
      buoy: { ...trinidadNowData().buoy!, observedAt: new Date(PT('17:20')).toISOString(), observedAtMs: PT('17:20') }
    });
    const r = evaluateNow(PT('17:30'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('GO');
    expect(r.returnByMs).toBe(DUSK);
  });
});

describe('evaluateNow — condition factors', () => {
  it('fresh buoy, calm wind: GO with passing factors', () => {
    const r = evaluateNow(PT('14:00'), dayVerdict(trinidadNowData()), TRINIDAD)!;
    expect(r.verdict).toBe('GO');
    const swell = r.factors.find((f) => f.name === 'Swell height')!;
    expect(swell.status).toBe('pass');
    expect(swell.value).toBe('3.2 ft');
    const wind = r.factors.find((f) => f.name === 'Sustained wind')!;
    expect(wind.status).toBe('pass');
    expect(r.staleness.degraded).toBe(false);
  });

  it('stale buoy (>60 min): factors floor at warn, verdict degrades to CONDITIONAL', () => {
    const nd = trinidadNowData({
      buoy: { ...trinidadNowData().buoy!, observedAt: new Date(PT('11:00')).toISOString(), observedAtMs: PT('11:00') }
    });
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('CONDITIONAL'); // swell + period both floored → ≥2 warns
    expect(r.staleness.degraded).toBe(true);
    expect(r.staleness.obsAgeMs).toBe(3 * 3_600_000);
    const swell = r.factors.find((f) => f.name === 'Swell height')!;
    expect(swell.status).toBe('warn');
    expect(swell.note).toMatch(/buoy data 3 h old/);
  });

  it('stale buoy does NOT mask a failing reading', () => {
    const nd = trinidadNowData({
      buoy: {
        ...trinidadNowData().buoy!,
        observedAt: new Date(PT('11:00')).toISOString(), observedAtMs: PT('11:00'),
        waveHtFt: 7.0
      }
    });
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.factors.find((f) => f.name === 'Swell height')!.status).toBe('fail');
  });

  it('missing buoy at an open-ocean launch: NO-GO, cannot verify', () => {
    const r = evaluateNow(PT('14:00'), dayVerdict(trinidadNowData({ buoy: undefined })), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/Live buoy/);
    expect(r.nextViableAtMs).toBeUndefined();
  });

  it('swell over threshold: plain NO-GO with no nextViableAtMs', () => {
    const nd = trinidadNowData({ buoy: { ...trinidadNowData().buoy!, waveHtFt: 7.0 } });
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/Swell height/);
    expect(r.nextViableAtMs).toBeUndefined();
  });

  it('wind from the worst point period overlapping the trip span', () => {
    const nd = trinidadNowData({
      pointPeriods: [
        { startMs: PT('06:00'), endMs: PT('15:00'), windSpeed: '5 to 10 mph', windDirection: 'NW' },
        { startMs: PT('15:00'), endMs: PT('18:00'), windSpeed: '20 to 25 mph', windDirection: 'NW' }
      ]
    });
    // Trip span 14:00–18:00 overlaps both periods; 25 mph ≈ 21.7 kt > 15 kt → fail.
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    const wind = r.factors.find((f) => f.name === 'Sustained wind')!;
    expect(wind.status).toBe('fail');
  });

  it('no period covers the span: falls back to the day wind check, flagged', () => {
    const day = dayVerdict(trinidadNowData({ pointPeriods: [] }));
    day.checks.push({
      layer: 'safety', name: 'Sustained wind', value: '8 kt NW',
      threshold: '≤ 15 kt', status: 'pass', note: 'NWS point forecast (Trinidad Harbor), high end of range used'
    });
    const r = evaluateNow(PT('14:00'), day, TRINIDAD)!;
    const wind = r.factors.find((f) => f.name === 'Sustained wind')!;
    expect(wind.status).toBe('pass');
    expect(wind.note).toMatch(/whole-day forecast/);
  });

  it('temporal blocker pointing into failing conditions: nextViableAtMs is withheld', () => {
    // Same mid-ebb scenario as Task 6. Bay launches carry no swell factor, so
    // the failing condition at the 18:00 slack is wind: calm until 18:00, gale after.
    const nd = bayNowData([
      ev('2026-06-10T12:00', 'slack', 0),
      ev('2026-06-10T15:00', 'ebb', -2.5),
      ev('2026-06-10T18:00', 'slack', 0)
    ]);
    nd.pointPeriods = [
      { startMs: PT('06:00'), endMs: PT('18:00'), windSpeed: '5 to 10 mph', windDirection: 'NW' },
      { startMs: PT('18:00'), endMs: PT('06:00', '2026-06-11'), windSpeed: '25 to 30 mph', windDirection: 'NW' }
    ];
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), BAY)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/^Not now/);
    expect(r.nextViableAtMs).toBeUndefined(); // 18:00 start would run into 25-30 mph wind
  });
});

describe('evaluateNow — degraded data', () => {
  it('currents launch with no currents data: fail closed, NO-GO', () => {
    const nd = bayNowData([]);
    delete nd.tidalCurrents;
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), BAY)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/tide phase/i);
    expect(r.nextViableAtMs).toBeUndefined();
  });

  it('currents launch with empty events list: fail closed, NO-GO', () => {
    const r = evaluateNow(PT('14:00'), dayVerdict(bayNowData([])), BAY)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/tide phase/i);
  });

  it('buoy row with null wave height: fail closed, not a silent GO', () => {
    const nd = trinidadNowData({
      buoy: { ...trinidadNowData().buoy!, waveHtFt: null, dominantPeriodSec: null }
    });
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.factors.find((f) => f.name === 'Swell height')!.value).toMatch(/no wave data/);
  });

  it('stale buoy with a single wave factor still degrades to CONDITIONAL', () => {
    const nd = trinidadNowData({
      buoy: {
        ...trinidadNowData().buoy!,
        observedAt: new Date(PT('11:00')).toISOString(), observedAtMs: PT('11:00'),
        dominantPeriodSec: null
      }
    });
    const r = evaluateNow(PT('14:00'), dayVerdict(nd), TRINIDAD)!;
    expect(r.verdict).toBe('CONDITIONAL');
    expect(r.factors.some((f) => f.name === 'Buoy obs age')).toBe(true);
  });

  it('tide-blocked with no viable start left today reads as done for today', () => {
    // Hostile rising ebb at 14:30; only remaining slack lands past dusk−2h, so the scan is empty.
    // At 14:30, frac = (14:30−13:00)/(16:30−13:00) = 90/210 = 0.4286, vel = 2.5·sin(π/2·0.4286) ≈ 1.56 > 1.5 → hostile.
    // Candidates: slack 19:45 > duskMs−2h (19:00) → filtered; dawn+30 is past. Scan empty.
    const nd = bayNowData([
      ev('2026-06-10T13:00', 'slack', 0),
      ev('2026-06-10T16:30', 'ebb', -2.5),
      ev('2026-06-10T19:45', 'slack', 0)
    ]);
    const r = evaluateNow(PT('14:30'), dayVerdict(nd), BAY)!;
    expect(r.verdict).toBe('NO-GO');
    expect(r.reason).toMatch(/^Done for today/);
    expect(r.nextViableAtMs).toBeUndefined();
  });
});
