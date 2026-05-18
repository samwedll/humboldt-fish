import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runLogistics,
  annotateWindowWithTide
} from '../../../src/lib/verdict/runLogistics.js';
import { parseCurrents } from '../../../src/lib/fetchers/currents.js';
import type { FetchedData, TidalCurrents } from '../../../src/lib/types.js';

const currentsFixture: TidalCurrents = parseCurrents(
  JSON.parse(readFileSync(resolve('tests/fixtures/currents-HUB0203.json'), 'utf-8')),
  'HUB0203'
);

function dataWithCurrents(): FetchedData {
  return { ...data(), tidalCurrents: currentsFixture };
}

function data(): FetchedData {
  return {
    ndbc46244: null,
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: null,
    tides: null,
    tidalCurrents: null,
    suntimes: {
      byDate: {
        '2026-05-18': {
          civilDawn: '2026-05-18T12:30:00Z',
          sunrise: '2026-05-18T13:05:00Z',
          sunset: '2026-05-19T03:30:00Z',
          civilDusk: '2026-05-19T04:00:00Z'
        }
      }
    }
  };
}

describe('runLogistics', () => {
  it('returns Trinidad launch + gear list', () => {
    const r = runLogistics({
      species: 'rockfish',
      date: '2026-05-18',
      launch: 'trinidad',
      data: data()
    });
    expect(r.result.status).toBe('pass');
    expect(r.recommendations.gear?.length).toBeGreaterThan(0);
    expect(r.recommendations.window).toBeDefined();
  });

  it('salmon recommendation: barbless single-point, no descender', () => {
    const r = runLogistics({
      species: 'salmon',
      date: '2026-06-20',
      launch: 'trinidad',
      data: data()
    });
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('descender'))).toBe(
      false
    );
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('barbless'))).toBe(
      true
    );
  });

  it('surfaces the solo-outside-jetties restriction at Trinidad', () => {
    const r = runLogistics({
      species: 'rockfish',
      date: '2026-05-18',
      launch: 'trinidad',
      data: data()
    });
    const solo = r.checks.find((c) => c.name === 'Solo restriction');
    expect(solo).toBeDefined();
    expect(solo!.note).toMatch(/solo/i);
    expect(solo!.note).toMatch(/accompanied/i);
  });

  it('cutthroat at big-lagoon: gear includes barbless lure language', () => {
    const r = runLogistics({
      species: 'cutthroat',
      date: '2026-05-18',
      launch: 'big-lagoon',
      data: data()
    });
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('barbless'))).toBe(true);
  });

  it('surfperch at mad-river-slough: gear includes surf rod', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'mad-river-slough',
      data: data()
    });
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('surf rod'))).toBe(true);
  });

  it('slough launch surfaces a tide-planning check', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'mad-river-slough',
      data: data()
    });
    const tide = r.checks.find((c) => c.name === 'Tide planning');
    expect(tide).toBeDefined();
    expect(tide!.status).toBe('pass');
  });

  it('big-lagoon launch: no tide-planning check, no solo restriction', () => {
    const r = runLogistics({
      species: 'cutthroat',
      date: '2026-05-18',
      launch: 'big-lagoon',
      data: data()
    });
    expect(r.checks.find((c) => c.name === 'Tide planning')).toBeUndefined();
    expect(r.checks.find((c) => c.name === 'Solo restriction')).toBeUndefined();
    // It should have a "Solo" pass check instead
    const solo = r.checks.find((c) => c.name === 'Solo');
    expect(solo).toBeDefined();
    expect(solo!.value).toBe('permitted');
  });

  it('humboldt-bay-interior: tide-planning check present', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: data()
    });
    expect(r.checks.find((c) => c.name === 'Tide planning')).toBeDefined();
  });

  it('mad-river-slough with currents data: tidal-currents check has morning slack and flood/ebb peaks', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-17',
      launch: 'mad-river-slough',
      data: dataWithCurrents()
    });
    const tc = r.checks.find((c) => c.name === 'Tidal currents');
    expect(tc).toBeDefined();
    expect(tc!.status).toBe('pass');
    // Fixture morning slack on 2026-05-17 is 07:28.
    expect(tc!.value).toMatch(/Morning slack 07:28/);
    expect(tc!.value).toMatch(/flood peaks/);
    expect(tc!.value).toMatch(/ebb peaks/);
    expect(tc!.value).toMatch(/kt/);
    expect(tc!.note).toMatch(/last 90 min of flood/i);
  });

  it('humboldt-bay-interior with currents data: tidal-currents check present', () => {
    const r = runLogistics({
      species: 'california-halibut',
      date: '2026-05-17',
      launch: 'humboldt-bay-interior',
      data: dataWithCurrents()
    });
    const tc = r.checks.find((c) => c.name === 'Tidal currents');
    expect(tc).toBeDefined();
    expect(tc!.status).toBe('pass');
  });

  it('trinidad: no tidal-currents check (launch has no currentStation)', () => {
    const r = runLogistics({
      species: 'rockfish',
      date: '2026-05-17',
      launch: 'trinidad',
      data: dataWithCurrents()
    });
    expect(r.checks.find((c) => c.name === 'Tidal currents')).toBeUndefined();
  });

  it('mad-river-slough with currents missing: tidal-currents check shows unknown status, not failure', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-17',
      launch: 'mad-river-slough',
      data: data()
    });
    const tc = r.checks.find((c) => c.name === 'Tidal currents');
    expect(tc).toBeDefined();
    expect(tc!.status).toBe('unknown');
    expect(tc!.value).toMatch(/data unavailable/i);
    // Logistics layer should still pass overall — currents are informational.
    expect(r.result.status).toBe('pass');
  });

  it('big-lagoon: no tidal-currents check even when currents data is present (lagoon has no currentStation)', () => {
    const r = runLogistics({
      species: 'cutthroat',
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: dataWithCurrents()
    });
    expect(r.checks.find((c) => c.name === 'Tidal currents')).toBeUndefined();
  });

  it('pacific-halibut at trinidad: gear + Trip risk + Pacific halibut quota checks', () => {
    const r = runLogistics({
      species: 'pacific-halibut',
      date: '2026-05-18',
      launch: 'trinidad',
      data: data()
    });
    expect(
      r.recommendations.gear?.some((g) => g.toLowerCase().includes('pacific halibut card'))
    ).toBe(true);
    const tripRisk = r.checks.find((c) => c.name === 'Trip risk');
    expect(tripRisk).toBeDefined();
    expect(tripRisk!.note).toMatch(/deep-water/i);
    const quota = r.checks.find((c) => c.name === 'Pacific halibut quota');
    expect(quota).toBeDefined();
    expect(quota!.note).toMatch(/IPHC/i);
  });

  it('albacore-tuna at trinidad: gear mentions 60°F water; Trip risk check present', () => {
    const r = runLogistics({
      species: 'albacore-tuna',
      date: '2026-05-18',
      launch: 'trinidad',
      data: data()
    });
    expect(r.recommendations.gear?.some((g) => g.includes('60°F'))).toBe(true);
    const tripRisk = r.checks.find((c) => c.name === 'Trip risk');
    expect(tripRisk).toBeDefined();
    expect(tripRisk!.note).toMatch(/pelagic|paddle range/i);
    // No Pacific-halibut quota check for tuna
    expect(r.checks.find((c) => c.name === 'Pacific halibut quota')).toBeUndefined();
  });

  it('california-halibut at humboldt-bay-interior: gear includes spreader; no Trip risk', () => {
    const r = runLogistics({
      species: 'california-halibut',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: data()
    });
    expect(
      r.recommendations.gear?.some((g) => g.toLowerCase().includes('halibut spreader'))
    ).toBe(true);
    expect(r.checks.find((c) => c.name === 'Trip risk')).toBeUndefined();
  });

  it('dungeness-crab at mad-river-slough: gear includes hoop net and domoic-acid check', () => {
    const r = runLogistics({
      species: 'dungeness-crab',
      date: '2026-05-18',
      launch: 'mad-river-slough',
      data: data()
    });
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('hoop net'))).toBe(true);
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('domoic'))).toBe(true);
  });

  it('bluegill at freshwater-lagoon: gear mentions bobber/worms', () => {
    const r = runLogistics({
      species: 'bluegill',
      date: '2026-05-18',
      launch: 'freshwater-lagoon',
      data: data()
    });
    expect(
      r.recommendations.gear?.some(
        (g) => /bobber/i.test(g) || /worms/i.test(g)
      )
    ).toBe(true);
  });

  it('largemouth-bass at freshwater-lagoon: gear mentions Texas/plastic', () => {
    const r = runLogistics({
      species: 'largemouth-bass',
      date: '2026-05-18',
      launch: 'freshwater-lagoon',
      data: data()
    });
    expect(
      r.recommendations.gear?.some(
        (g) => /Texas/i.test(g) || /plastic/i.test(g)
      )
    ).toBe(true);
  });

  it('rainbow-trout at freshwater-lagoon: gear mentions PowerBait + planting', () => {
    const r = runLogistics({
      species: 'rainbow-trout',
      date: '2026-05-18',
      launch: 'freshwater-lagoon',
      data: data()
    });
    expect(r.recommendations.gear?.some((g) => /PowerBait/i.test(g))).toBe(true);
    expect(r.recommendations.gear?.some((g) => /planting/i.test(g))).toBe(true);
  });

  it('freshwater-lagoon: no tide-planning check, no tidal-currents check', () => {
    const r = runLogistics({
      species: 'rainbow-trout',
      date: '2026-05-18',
      launch: 'freshwater-lagoon',
      data: data()
    });
    expect(r.checks.find((c) => c.name === 'Tide planning')).toBeUndefined();
    expect(r.checks.find((c) => c.name === 'Tidal currents')).toBeUndefined();
  });
});

describe('runLogistics — multiple launch windows', () => {
  function dataWith(suntimes: import('../../../src/lib/types.js').SunTimes, tidalCurrents: import('../../../src/lib/types.js').TidalCurrents | null = null): import('../../../src/lib/types.js').FetchedData {
    return {
      ndbc46244: null, ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
      tidalCurrents, suntimes
    };
  }
  const sun2026_05_18 = {
    byDate: {
      '2026-05-18': {
        civilDawn: '2026-05-18T12:30:00Z',  // 05:30 PT
        sunrise: '2026-05-18T13:05:00Z',
        sunset: '2026-05-19T03:30:00Z',
        civilDusk: '2026-05-19T04:00:00Z'   // 21:00 PT
      }
    }
  };

  it('Trinidad: morning window only (no evening — Pacific wind builds after 11 AM)', () => {
    const r = runLogistics({ species: 'rockfish', date: '2026-05-18', launch: 'trinidad', data: dataWith(sun2026_05_18) });
    const windows = r.recommendations.windows!;
    expect(windows.length).toBe(1);
    expect(windows[0].label).toBe('Morning');
    expect(windows[0].rationale).toMatch(/wind/i);
  });

  it('every window has a checkInBy time (returnBy + 1 hour) for shore-comm float plans', () => {
    const r = runLogistics({ species: 'cutthroat', date: '2026-05-18', launch: 'big-lagoon', data: dataWith(sun2026_05_18) });
    for (const w of r.recommendations.windows!) {
      expect(w.checkInBy).toMatch(/^\d{2}:\d{2} PT$/);
      // checkInBy parses as a higher hour-minute than returnBy
      const ret = parseInt(w.returnBy.split(':')[0]) * 60 + parseInt(w.returnBy.split(':')[1].slice(0, 2));
      const chk = parseInt(w.checkInBy.split(':')[0]) * 60 + parseInt(w.checkInBy.split(':')[1].slice(0, 2));
      const delta = ((chk - ret) + 24 * 60) % (24 * 60);
      expect(delta).toBe(60);
    }
  });

  it('Big Lagoon: morning + evening windows', () => {
    const r = runLogistics({ species: 'cutthroat', date: '2026-05-18', launch: 'big-lagoon', data: dataWith(sun2026_05_18) });
    const windows = r.recommendations.windows!;
    expect(windows.length).toBe(2);
    expect(windows[0].label).toBe('Morning');
    expect(windows[1].label).toBe('Evening');
  });

  it('Freshwater Lagoon: morning + evening windows', () => {
    const r = runLogistics({ species: 'bluegill', date: '2026-05-18', launch: 'freshwater-lagoon', data: dataWith(sun2026_05_18) });
    const windows = r.recommendations.windows!;
    expect(windows.length).toBe(2);
    expect(windows.map((w) => w.label)).toEqual(['Morning', 'Evening']);
  });

  it('Mad River Slough with afternoon slack data: 3 windows (morning + evening + slack)', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'mad-river-slough',
      data: dataWith(sun2026_05_18, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T08:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T13:11', type: 'flood', velocityKt: 1.9, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T15:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T18:16', type: 'ebb', velocityKt: -1.4, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    const windows = r.recommendations.windows!;
    expect(windows.length).toBe(3);
    expect(windows.find((w) => /slack/i.test(w.label))).toBeDefined();
  });

  it('Humboldt Bay interior without currents data: 2 windows (morning + evening, no slack window)', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_18, null)
    });
    const windows = r.recommendations.windows!;
    expect(windows.length).toBe(2);
    expect(windows.find((w) => /slack/i.test(w.label))).toBeUndefined();
  });

  it('legacy `window` string is still populated for backward compat', () => {
    const r = runLogistics({ species: 'cutthroat', date: '2026-05-18', launch: 'big-lagoon', data: dataWith(sun2026_05_18) });
    expect(r.recommendations.window).toMatch(/Launch.*return by.*4-hour/);
  });
});

describe('annotateWindowWithTide', () => {
  const fixture = currentsFixture;

  it('window across a flood event: phase=flood, peak detected', () => {
    // 2026-05-17: slack 07:28, flood-peak 11:22 at 2.09 kt, slack 14:17.
    // Window 09:00–13:00 covers the rising-flood peak.
    const a = annotateWindowWithTide('2026-05-17T09:00', '2026-05-17T13:00', fixture);
    expect(a.phase).toBe('flood');
    expect(a.peakSpeedKt).toBeCloseTo(2.09, 2);
    expect(a.peakType).toBe('flood');
    expect(a.peakTimeLocal).toBe('11:22 PT');
    expect(a.description).toMatch(/flood/i);
    expect(a.description).toMatch(/2\.1 kt/);
  });

  it('window straddling a slack: phase=mixed', () => {
    // 2026-05-17: flood-peak 11:22, slack 14:17, ebb-peak 16:32 at -1.56.
    // Window 13:00–17:00 straddles the 14:17 slack. Ebb peak (1.56) is the
    // only non-slack event inside the window.
    const a = annotateWindowWithTide('2026-05-17T13:00', '2026-05-17T17:00', fixture);
    expect(a.phase).toBe('mixed');
    expect(a.peakSpeedKt).toBeCloseTo(1.56, 2);
    expect(a.peakType).toBe('ebb');
    expect(a.description).toMatch(/slack/i);
  });

  it('ebb-heavy morning window: phase=ebb, peak detected', () => {
    // 2026-05-18: slack 01:06, ebb-peak 04:14 at -3.34 kt, slack 08:12.
    // Window 03:00–07:00 covers ebb peak.
    const a = annotateWindowWithTide('2026-05-18T03:00', '2026-05-18T07:00', fixture);
    expect(a.phase).toBe('ebb');
    expect(a.peakSpeedKt).toBeCloseTo(3.34, 2);
    expect(a.peakType).toBe('ebb');
    expect(a.peakTimeLocal).toBe('04:14 PT');
  });

  it('window with no events inside: defensive peakTimeLocal, no out-of-window time leakage', () => {
    // Synthetic fixture with events only OUTSIDE the requested window range.
    // Window 06:00–08:00. Events: ebb-peak at 04:14 (before), slack at 08:30 (just after).
    const synth: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T04:14', type: 'ebb', velocityKt: -3.34, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T08:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const a = annotateWindowWithTide('2026-05-18T06:00', '2026-05-18T08:00', synth);
    // peakSpeedKt = 0 (no event inside), peakType = 'slack', peakTimeLocal anchored to windowStart.
    expect(a.peakSpeedKt).toBe(0);
    expect(a.peakType).toBe('slack');
    expect(a.peakTimeLocal).toBe('06:00 PT');
    // Description must NOT reference out-of-window times like "04:14".
    expect(a.description).not.toMatch(/04:14/);
  });
});
