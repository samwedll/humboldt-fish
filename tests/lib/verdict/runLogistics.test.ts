import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runLogistics,
  annotateWindowWithTide,
  clampReturnByForEbb,
  buildMorningSlackWindow
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

  it('Mad River Slough with afternoon slack data: 4 windows (morning + morning-slack + evening + slack)', () => {
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
    expect(windows.length).toBe(4);
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

  it('bay launch with clean flood morning: window has tide annotation, no warning, no clamp', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_18, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T08:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T12:00', type: 'flood', velocityKt: 1.8, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T15:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    const morning = r.recommendations.windows!.find((w) => w.label === 'Morning');
    expect(morning).toBeDefined();
    expect(morning!.tide).toBeDefined();
    expect(morning!.warning).toBeUndefined();
    expect(morning!.returnBy).toBe('10:00 PT');
    // Healthy day with a live morning window: the "no compliant morning" note
    // must NOT be appended (guards the hasLiveMorning negative branch).
    const tc = r.checks.find((c) => c.name === 'Tidal currents');
    expect(tc!.note).not.toMatch(/no compliant morning/i);
  });

  it('bay launch with ebb-heavy morning: Morning window kept as a suppressed stub (not dropped)', () => {
    const sun2026_05_21 = {
      byDate: {
        '2026-05-21': {
          civilDawn: '2026-05-21T12:30:00Z',
          sunrise: '2026-05-21T13:05:00Z',
          sunset: '2026-05-22T03:30:00Z',
          civilDusk: '2026-05-22T04:00:00Z'
        }
      }
    };
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-21',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_21, currentsFixture)
    });
    const morning = r.recommendations.windows!.find((w) => w.label === 'Morning');
    // Previously this window was silently dropped; now it survives as a greyed
    // stub so the user can see WHY the morning is unavailable.
    expect(morning).toBeDefined();
    expect(morning!.suppressed).toBe(true);
    expect(morning!.suppressedReason).toMatch(/ebb/i);
  });

  it('bay launch tide-rich day: up to 4 windows surfaced', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_18, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T07:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T10:00', type: 'flood', velocityKt: 1.2, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T13:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T15:30', type: 'ebb', velocityKt: -1.0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T19:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    const labels = r.recommendations.windows!.map((w) => w.label);
    expect(labels).toContain('Morning');
    expect(labels).toContain('Evening');
    expect(labels.some((l) => /07:30 slack/i.test(l))).toBe(true);
    expect(labels.some((l) => /13:00 slack/i.test(l))).toBe(true);
    expect(r.recommendations.windows!.length).toBe(4);
  });

  it('slack-anchored windows are annotated but never warned', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_18, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T07:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T10:00', type: 'flood', velocityKt: 1.2, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T13:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T15:30', type: 'ebb', velocityKt: -1.0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T17:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    const slack = r.recommendations.windows!.find((w) => /slack/i.test(w.label));
    expect(slack).toBeDefined();
    expect(slack!.tide).toBeDefined();
    expect(slack!.warning).toBeUndefined();
  });

  it('Trinidad: no tide annotation on its windows (no currentStation)', () => {
    const r = runLogistics({
      species: 'rockfish',
      date: '2026-05-18',
      launch: 'trinidad',
      data: dataWith(sun2026_05_18, currentsFixture)
    });
    for (const w of r.recommendations.windows!) {
      expect(w.tide).toBeUndefined();
      expect(w.warning).toBeUndefined();
    }
  });

  it('bay launch flood > 3.0 kt: window gets flood warning but no clamp', () => {
    const sun = {
      byDate: {
        '2026-05-18': {
          civilDawn: '2026-05-18T12:30:00Z',
          sunrise: '2026-05-18T13:05:00Z',
          sunset: '2026-05-19T03:30:00Z',
          civilDusk: '2026-05-19T04:00:00Z'
        }
      }
    };
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T16:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T19:00', type: 'flood', velocityKt: 3.4, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T22:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    const evening = r.recommendations.windows!.find((w) => w.label === 'Evening');
    expect(evening).toBeDefined();
    expect(evening!.warning).toMatch(/flood/i);
    expect(evening!.warning).toMatch(/3\.4 kt/);
    expect(evening!.returnBy).toBe('21:00 PT');
  });

  it('evening window symmetric to morning: demoted + clamped on a soft late ebb', () => {
    const sun = {
      byDate: {
        '2026-05-18': {
          civilDawn: '2026-05-18T12:30:00Z',
          sunrise: '2026-05-18T13:05:00Z',
          sunset: '2026-05-19T03:30:00Z',
          civilDusk: '2026-05-19T04:00:00Z'
        }
      }
    };
    // Peak at 20:30 (-1.6 kt) inside the 17:00–21:00 window. With slack 16:30,
    // span = 240 min, sinusoidal frac for 1.5/1.6 kt:
    //   frac = (2/pi)*asin(0.9375) ≈ 0.7699
    //   crossing = floor(990 + 240*0.7699) = 1175 → 19:35
    //   clamped  = 1175 - 15 = 1160 → 19:20 PT
    //   trip     = 17:00 → 19:20 = 2h20m > 2h ✓
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T16:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T20:30', type: 'ebb', velocityKt: -1.6, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T22:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    const evening = r.recommendations.windows!.find((w) => w.label === 'Evening');
    expect(evening).toBeDefined();
    expect(evening!.warning).toMatch(/ebb/i);
    expect(evening!.warning).toMatch(/1\.6 kt/);
    expect(evening!.returnBy).toBe('19:20 PT');
  });

  it('Big Lagoon: no tide annotation even with currents data (no currentStation)', () => {
    const r = runLogistics({
      species: 'cutthroat',
      date: '2026-05-18',
      launch: 'big-lagoon',
      data: dataWith(sun2026_05_18, currentsFixture)
    });
    for (const w of r.recommendations.windows!) {
      expect(w.tide).toBeUndefined();
      expect(w.warning).toBeUndefined();
    }
  });

  it('annotation tolerates non-zero-padded launchAt labels (defensive ISO reconstruction)', () => {
    // This is a runtime-portability test: build a fixture identical to the
    // "clean flood morning" test but check that the launchAt string parsing
    // works regardless of whether the formatter pads hours.
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_18, {
        station: 'HUB0203',
        units: 'feet, knots',
        events: [
          { time: '2026-05-18T08:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T12:00', type: 'flood', velocityKt: 1.8, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
          { time: '2026-05-18T15:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
        ]
      })
    });
    // The Morning window should have a valid tide annotation. If ISO
    // reconstruction is broken, annotation produces nonsense (peakSpeedKt = 0).
    const morning = r.recommendations.windows!.find((w) => w.label === 'Morning');
    expect(morning).toBeDefined();
    expect(morning!.tide).toBeDefined();
    // Window 06:00–10:00 spans slack 08:00 → flood building. Phase = mixed.
    expect(morning!.tide!.phase).toBe('mixed');
  });

  it('morning slack but no compliant morning window: only Evening is live, morning stubs explain why, check is annotated', () => {
    // Reproduces 2026-06-07 at a bay launch. The morning slack (05:05) lands 8
    // min after civil dawn (05:13), so a slack-anchored launch would be pre-dawn;
    // AND a 1.65 kt ebb builds right after it, clamping the dawn window under 2 h.
    // Result: a real morning slack, but no compliant morning launch window.
    const sun = {
      byDate: {
        '2026-06-07': {
          civilDawn: '2026-06-07T12:13:00Z', // 05:13 PT
          sunrise: '2026-06-07T12:50:00Z',
          sunset: '2026-06-08T04:00:00Z',
          civilDusk: '2026-06-08T04:20:00Z' // 21:20 PT
        }
      }
    };
    const currents: import('../../../src/lib/types.js').TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-06-07T00:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T02:35', type: 'flood', velocityKt: 0.78, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T05:05', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T07:59', type: 'ebb', velocityKt: -1.65, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T11:39', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T16:16', type: 'flood', velocityKt: 1.24, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T19:07', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T21:33', type: 'ebb', velocityKt: -1.11, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-06-07',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun, currents)
    });

    const live = r.recommendations.windows!.filter((w) => !w.suppressed);
    expect(live.map((w) => w.label)).toEqual(['Evening']);

    // Both morning candidates survive as suppressed stubs (dawn window + pre-dawn slack).
    const suppressed = r.recommendations.windows!.filter((w) => w.suppressed);
    expect(suppressed.length).toBe(2);
    expect(suppressed.every((w) => !!w.suppressedReason)).toBe(true);

    const tc = r.checks.find((c) => c.name === 'Tidal currents');
    expect(tc!.value).toMatch(/Morning slack 05:05/);
    expect(tc!.note).toMatch(/no compliant morning/i);

    // Legacy single-window string points at the live Evening window, not a stub.
    expect(r.recommendations.window).toMatch(/Launch 17:20 PT/);
  });

  it('all windows suppressed (hostile ebb across dawn AND dusk): no live window, legacy `window` string is undefined', () => {
    // Spring-tide-shaped day where strong ebbs clamp both the dawn and dusk
    // twilight windows AND the morning slack is pre-dawn — every candidate dies.
    // The legacy single-window string must be undefined, never a suppressed stub
    // dressed up as a launchable 4-hour trip (conservative-defaults invariant).
    const sun = {
      byDate: {
        '2026-06-07': {
          civilDawn: '2026-06-07T12:13:00Z', // 05:13 PT
          sunrise: '2026-06-07T12:50:00Z',
          sunset: '2026-06-08T04:00:00Z',
          civilDusk: '2026-06-08T04:20:00Z' // 21:20 PT
        }
      }
    };
    const currents: import('../../../src/lib/types.js').TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-06-07T05:05', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T07:00', type: 'ebb', velocityKt: -3.0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T10:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T16:00', type: 'ebb', velocityKt: -3.5, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T18:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-06-07',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun, currents)
    });
    const windows = r.recommendations.windows!;
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((w) => w.suppressed)).toBe(true);
    expect(r.recommendations.window).toBeUndefined();
  });

  it('dawn window suppressed but a post-dawn morning slack stays live: slack offered, no "no compliant morning" note', () => {
    // The dawn twilight window clamps on a building ebb, but the morning slack is
    // AFTER civil dawn so its slack-anchored window is launchable. A live morning
    // option exists → the annotation must NOT fire and the slack stays copyable.
    const sun = {
      byDate: {
        '2026-06-07': {
          civilDawn: '2026-06-07T12:13:00Z', // 05:13 PT
          sunrise: '2026-06-07T12:50:00Z',
          sunset: '2026-06-08T04:00:00Z',
          civilDusk: '2026-06-08T04:20:00Z' // 21:20 PT
        }
      }
    };
    const currents: import('../../../src/lib/types.js').TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-06-07T03:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T06:00', type: 'ebb', velocityKt: -3.0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T09:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T13:00', type: 'flood', velocityKt: 1.5, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-06-07T18:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-06-07',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun, currents)
    });
    const slackW = r.recommendations.windows!.find((w) => /09:00 slack/.test(w.label));
    expect(slackW).toBeDefined();
    expect(slackW!.suppressed).toBeFalsy();
    const morning = r.recommendations.windows!.find((w) => w.label === 'Morning');
    expect(morning!.suppressed).toBe(true);
    const tc = r.checks.find((c) => c.name === 'Tidal currents');
    expect(tc!.note).not.toMatch(/no compliant morning/i);
  });

  it('bay launch with currents missing: windows match today (no tide, no warning, no morning-slack)', () => {
    const r = runLogistics({
      species: 'surfperch',
      date: '2026-05-18',
      launch: 'humboldt-bay-interior',
      data: dataWith(sun2026_05_18, null)
    });
    for (const w of r.recommendations.windows!) {
      expect(w.tide).toBeUndefined();
      expect(w.warning).toBeUndefined();
    }
    expect(r.recommendations.windows!.length).toBe(2); // Morning + Evening only
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

describe('clampReturnByForEbb', () => {
  const fixture = currentsFixture;

  it('no ebb above threshold inside or just after window: no clamp', () => {
    const r = clampReturnByForEbb('2026-05-17T09:00', '2026-05-17T13:00', fixture);
    expect(r.suppressed).toBe(false);
    expect(r.newEnd).toBe('2026-05-17T13:00');
  });

  it('ebb-heavy afternoon: clamps before threshold crossing (≥ 2h trip remaining)', () => {
    // Slack 13:00 → ebb-peak 17:30 at -1.8 kt → slack 20:00. Span = 270 min.
    // Sinusoidal crossing: frac = (2/pi)*asin(1.5/1.8) ≈ 0.6272
    //   t = floor(780 + 270*0.6272) = floor(780 + 169.4) = floor(949.4) = 949 → 15:49
    //   clamped = 949 - 15 = 934 → 15:34
    //   trip 13:30 (810) → 15:34 (934) = 124 min = 2h4m > 2h ✓
    const synth: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T13:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T17:30', type: 'ebb', velocityKt: -1.8, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T20:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const r = clampReturnByForEbb('2026-05-18T13:30', '2026-05-18T17:30', synth);
    expect(r.suppressed).toBe(false);
    expect(r.newEnd).toBe('2026-05-18T15:34');
  });

  it('window collapses below 2h: suppressed', () => {
    // 2026-05-21 fixture: slack 03:29 → ebb-peak 06:30 at -2.47 → slack 10:42.
    // Window 04:00 → 08:00. Crossing 1.5 kt at ~05:19 building. Clamped end
    // 05:04. Trip 04:00 → 05:04 = 1h4m. Below 2h → suppress.
    const r = clampReturnByForEbb('2026-05-21T04:00', '2026-05-21T08:00', fixture);
    expect(r.suppressed).toBe(true);
  });

  it('launch already in hostile ebb: suppressed', () => {
    // 2026-05-18 ebb peak 04:14 at -3.34. Launch at 04:00 is mid-ebb (already
    // above 1.5 kt). Suppress.
    const r = clampReturnByForEbb('2026-05-18T04:00', '2026-05-18T08:00', fixture);
    expect(r.suppressed).toBe(true);
  });

  it('launch on descending side of prior ebb still hostile: suppressed', () => {
    // Ebb peak at 03:30 (-2.5 kt), slack after at 06:30. Window 04:00–08:00.
    // At 04:00 (descending side, 30 min past peak):
    //   |v|(04:00) = 2.5 * (06:30 − 04:00)/(06:30 − 03:30) = 2.5 * 150/180 = 2.08 kt.
    // Above 1.5 kt threshold → suppressed.
    const synth: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T01:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T03:30', type: 'ebb', velocityKt: -2.5, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T06:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const r = clampReturnByForEbb('2026-05-18T04:00', '2026-05-18T08:00', synth);
    expect(r.suppressed).toBe(true);
  });

  it('min-trip suppression carries a reason naming the ebb', () => {
    // Same scenario as "window collapses below 2h" — clamp leaves < 2 h trip.
    const r = clampReturnByForEbb('2026-05-21T04:00', '2026-05-21T08:00', fixture);
    expect(r.suppressed).toBe(true);
    expect(r.reason).toMatch(/ebb/i);
    expect(r.reason).toMatch(/2\s*h|1\.5 kt/i);
  });

  it('hostile-ebb-at-launch suppression carries a reason', () => {
    const r = clampReturnByForEbb('2026-05-18T04:00', '2026-05-18T08:00', fixture);
    expect(r.suppressed).toBe(true);
    expect(r.reason).toMatch(/ebb/i);
  });
});

describe('buildMorningSlackWindow', () => {
  const civilDawn = new Date('2026-05-18T12:30:00Z'); // 05:30 PT

  it('returns a window when a slack falls between 04:00 and 11:00 local', () => {
    // 2026-05-18: slack 08:12.
    const w = buildMorningSlackWindow(currentsFixture, '2026-05-18', civilDawn);
    expect(w).not.toBeNull();
    expect(w!.label).toMatch(/slack/i);
    expect(w!.launchAt).toBe('07:42 PT'); // 08:12 − 30 min
    expect(w!.returnBy).toBe('11:42 PT');  // 07:42 + 4h
    expect(w!.checkInBy).toBe('12:42 PT'); // returnBy + 1h
  });

  it('returns a suppressed stub (not null) when proposed launch is before civil dawn', () => {
    const synthetic: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T05:45', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    // launchAt would be 05:15 — civilDawn is 05:30. Keep it as a greyed stub
    // that explains why there is no compliant morning-slack launch.
    const w = buildMorningSlackWindow(synthetic, '2026-05-18', civilDawn);
    expect(w).not.toBeNull();
    expect(w!.launchAt).toBe('05:15 PT');
    expect(w!.suppressed).toBe(true);
    expect(w!.suppressedReason).toMatch(/dawn|first light|before/i);
  });

  it('returns null when no slack in 04:00–11:00 local', () => {
    const synthetic: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T13:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const w = buildMorningSlackWindow(synthetic, '2026-05-18', civilDawn);
    expect(w).toBeNull();
  });
});
