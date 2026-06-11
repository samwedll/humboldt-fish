import { describe, it, expect } from 'vitest';
import { buildNowData } from '../../../src/lib/verdict/buildNowData.js';
import { computeVerdict } from '../../../src/lib/verdict/computeVerdict.js';
import type { FetchedData } from '../../../src/lib/types.js';

const DATE = '2026-06-10';

function data(): FetchedData {
  return {
    ndbc46244: {
      observedAt: '2026-06-10T20:50:00Z',
      windKt: null, gustKt: null, windDirDeg: null,
      waveHtFt: 3.2, dominantPeriodSec: 12, meanWaveDirDeg: 290, waterTempF: 52
    },
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: {
      updated: '2026-06-10T10:00:00Z',
      periods: [
        {
          number: 1, name: 'Today', isDaytime: true, temperature: 60,
          startTime: '2026-06-10T06:00:00-07:00', endTime: '2026-06-10T18:00:00-07:00',
          windSpeed: '5 to 10 mph', windDirection: 'NW',
          shortForecast: 'Sunny', detailedForecast: 'Sunny.'
        }
      ]
    },
    tides: null,
    tidalCurrents: {
      station: 'HUB0203',
      units: 'knots',
      events: [
        { time: '2026-06-10T12:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 30, meanEbbDirDeg: 210 }
      ]
    },
    suntimes: {
      byDate: {
        [DATE]: {
          civilDawn: '2026-06-10T12:00:00Z',
          sunrise: '2026-06-10T12:35:00Z',
          sunset: '2026-06-11T03:30:00Z',
          civilDusk: '2026-06-11T04:00:00Z'
        }
      }
    }
  };
}

describe('buildNowData', () => {
  it('Trinidad: carries buoy (with observedAtMs) and point periods, no currents', () => {
    const nd = buildNowData({ date: DATE, launch: 'trinidad', data: data() })!;
    expect(nd.date).toBe(DATE);
    expect(nd.dawnMs).toBe(Date.parse('2026-06-10T12:00:00Z'));
    expect(nd.duskMs).toBe(Date.parse('2026-06-11T04:00:00Z'));
    expect(nd.buoy!.observedAtMs).toBe(Date.parse('2026-06-10T20:50:00Z'));
    expect(nd.buoy!.waveHtFt).toBe(3.2);
    expect(nd.tidalCurrents).toBeUndefined();
    expect(nd.pointPeriods![0].startMs).toBe(Date.parse('2026-06-10T06:00:00-07:00'));
    expect(nd.pointPeriods![0].windSpeed).toBe('5 to 10 mph');
  });

  it('Bay interior: carries currents verbatim, no buoy', () => {
    const nd = buildNowData({ date: DATE, launch: 'humboldt-bay-interior', data: data() })!;
    expect(nd.tidalCurrents!.station).toBe('HUB0203');
    expect(nd.buoy).toBeUndefined();
  });

  it('omits the buoy when observedAt is malformed (conservative path)', () => {
    const d = data();
    d.ndbc46244 = { ...d.ndbc46244!, observedAt: 'not-a-date' };
    expect(buildNowData({ date: DATE, launch: 'trinidad', data: d })!.buoy).toBeUndefined();
  });

  it('returns undefined when suntimes are missing for the date', () => {
    const d = data();
    d.suntimes = { byDate: {} };
    expect(buildNowData({ date: DATE, launch: 'trinidad', data: d })).toBeUndefined();
  });
});

describe('computeVerdict nowData attachment', () => {
  it('attaches nowData only when date === today', () => {
    const todayVerdict = computeVerdict({
      date: DATE, today: DATE, species: 'rockfish', launch: 'trinidad', data: data()
    });
    expect(todayVerdict.nowData).toBeDefined();
    expect(todayVerdict.nowData!.date).toBe(DATE);

    const futureVerdict = computeVerdict({
      date: '2026-06-11', today: DATE, species: 'rockfish', launch: 'trinidad', data: data()
    });
    expect(futureVerdict.nowData).toBeUndefined();
  });
});
