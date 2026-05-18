import { describe, it, expect } from 'vitest';
import { computeVerdict } from '../../../src/lib/verdict/computeVerdict.js';
import type { FetchedData } from '../../../src/lib/types.js';

function calmDayData(): FetchedData {
  return {
    ndbc46244: {
      observedAt: '2026-05-18T14:00:00Z',
      windKt: 6,
      gustKt: 8,
      windDirDeg: 270,
      waveHtFt: 3.5,
      dominantPeriodSec: 12,
      meanWaveDirDeg: 275,
      waterTempF: 52
    },
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: null,
    tides: {
      station: '9418767',
      events: [{ time: '2026-05-18T05:30:00', height: 4.5, type: 'H' }]
    },
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

describe('computeVerdict', () => {
  it('all-green calm-day → GO', () => {
    const v = computeVerdict({
      date: '2026-05-18',
      species: 'rockfish',
      launch: 'trinidad',
      data: calmDayData()
    });
    expect(v.verdict).toBe('GO');
  });

  it('Layer 1 fail → NO-GO and Layer 2/3/4 not run', () => {
    const v = computeVerdict({
      date: '2026-01-15',
      species: 'rockfish',
      launch: 'trinidad',
      data: calmDayData()
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.layers.safety.status).toBe('incomplete');
  });

  it('Layer 2 fail (May 17 case) → NO-GO', () => {
    const d = calmDayData();
    d.ndbc46244 = {
      observedAt: '2026-05-17T14:00:00Z',
      windKt: 12,
      gustKt: 16,
      windDirDeg: 290,
      waveHtFt: 10.5,
      dominantPeriodSec: 11,
      meanWaveDirDeg: 295,
      waterTempF: 51.8
    };
    const v = computeVerdict({
      date: '2026-05-17',
      species: 'rockfish',
      launch: 'trinidad',
      data: d
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.reason).toMatch(/Swell|Gust/);
  });

  it('2+ Layer 2 warns → CONDITIONAL with bailout', () => {
    const d = calmDayData();
    d.ndbc46244 = {
      observedAt: '2026-05-18T14:00:00Z',
      windKt: 13,
      gustKt: 14,
      windDirDeg: 270,
      waveHtFt: 4.5,
      dominantPeriodSec: 10.5,
      meanWaveDirDeg: 275,
      waterTempF: 52
    };
    const v = computeVerdict({
      date: '2026-05-18',
      species: 'rockfish',
      launch: 'trinidad',
      data: d
    });
    expect(v.verdict).toBe('CONDITIONAL');
    expect(v.recommendations.bailout).toBeDefined();
  });

  it('NDBC unavailable AND no NWS → INCOMPLETE', () => {
    const d = calmDayData();
    d.ndbc46244 = null;
    const v = computeVerdict({
      date: '2026-05-18',
      species: 'rockfish',
      launch: 'trinidad',
      data: d
    });
    expect(v.verdict).toBe('INCOMPLETE');
  });

  it('rockfish at big-lagoon → NO-GO (Layer 1 species-launch incompat)', () => {
    const v = computeVerdict({
      date: '2026-05-18',
      species: 'rockfish',
      launch: 'big-lagoon',
      data: calmDayData()
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.layers.legal.status).toBe('fail');
    expect(v.layers.safety.status).toBe('incomplete');
  });

  it('cutthroat at big-lagoon + March + 6 kt wind → GO', () => {
    const d = calmDayData();
    // shift the buoy + sun fixtures to a March date the function actually consults
    d.ndbc46244 = {
      observedAt: '2026-03-15T14:00:00Z',
      windKt: 6,
      gustKt: 8,
      windDirDeg: 270,
      waveHtFt: 3.5,
      dominantPeriodSec: 12,
      meanWaveDirDeg: 275,
      waterTempF: 52
    };
    d.suntimes.byDate['2026-03-15'] = {
      civilDawn: '2026-03-15T13:30:00Z',
      sunrise: '2026-03-15T14:05:00Z',
      sunset: '2026-03-16T02:30:00Z',
      civilDusk: '2026-03-16T03:00:00Z'
    };
    const v = computeVerdict({
      date: '2026-03-15',
      species: 'cutthroat',
      launch: 'big-lagoon',
      data: d
    });
    expect(v.verdict).toBe('GO');
  });

  it('surfperch at humboldt-bay-interior + calm + in season → GO', () => {
    const v = computeVerdict({
      date: '2026-05-18',
      species: 'surfperch',
      launch: 'humboldt-bay-interior',
      data: calmDayData()
    });
    expect(v.verdict).toBe('GO');
  });

  it('california-halibut at humboldt-bay-interior in May → GO on calm-data day', () => {
    const v = computeVerdict({
      date: '2026-05-18',
      species: 'california-halibut',
      launch: 'humboldt-bay-interior',
      data: calmDayData()
    });
    expect(v.verdict).toBe('GO');
  });

  it('pacific-halibut at trinidad on the May 17 storm day → NO-GO (Layer 2 swell)', () => {
    const d = calmDayData();
    d.ndbc46244 = {
      observedAt: '2026-05-17T14:00:00Z',
      windKt: 12,
      gustKt: 16,
      windDirDeg: 290,
      waveHtFt: 10.5,
      dominantPeriodSec: 11,
      meanWaveDirDeg: 295,
      waterTempF: 51.8
    };
    const v = computeVerdict({
      date: '2026-05-17',
      species: 'pacific-halibut',
      launch: 'trinidad',
      data: d
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.reason).toMatch(/Swell|Gust/);
    expect(v.layers.legal.status).toBe('pass');
    expect(v.layers.safety.status).toBe('fail');
  });

  it('pacific-halibut at big-lagoon → NO-GO (Layer 1 incompat)', () => {
    const v = computeVerdict({
      date: '2026-06-15',
      species: 'pacific-halibut',
      launch: 'big-lagoon',
      data: calmDayData()
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.layers.legal.status).toBe('fail');
    expect(v.layers.safety.status).toBe('incomplete');
  });

  it('dungeness-crab at humboldt-bay-interior on 2026-08-15 → NO-GO (off-season)', () => {
    const d = calmDayData();
    d.ndbc46244 = {
      observedAt: '2026-08-15T14:00:00Z',
      windKt: 6,
      gustKt: 8,
      windDirDeg: 270,
      waveHtFt: 3.5,
      dominantPeriodSec: 12,
      meanWaveDirDeg: 275,
      waterTempF: 56
    };
    d.suntimes.byDate['2026-08-15'] = {
      civilDawn: '2026-08-15T12:30:00Z',
      sunrise: '2026-08-15T13:05:00Z',
      sunset: '2026-08-16T03:30:00Z',
      civilDusk: '2026-08-16T04:00:00Z'
    };
    const v = computeVerdict({
      date: '2026-08-15',
      species: 'dungeness-crab',
      launch: 'humboldt-bay-interior',
      data: d
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.layers.legal.status).toBe('fail');
  });
});

describe('computeVerdict — dataSources field', () => {
  it('Trinidad + today with buoy + point present → buoy and point live, zone missing', () => {
    const v = computeVerdict({
      date: '2026-05-18',
      today: '2026-05-18',
      species: 'rockfish',
      launch: 'trinidad',
      data: {
        ndbc46244: {
          observedAt: '2026-05-18T14:00:00Z',
          windKt: 6, gustKt: 8, windDirDeg: 270,
          waveHtFt: 3.5, dominantPeriodSec: 12, meanWaveDirDeg: 275,
          waterTempF: 52
        },
        ndbc46022: null,
        nwsZone: null,
        nwsPoint: {
          updated: '2026-05-18T15:00:00Z',
          periods: [{
            number: 1, name: 'Today',
            startTime: '2026-05-18T09:00:00-07:00', endTime: '2026-05-18T18:00:00-07:00',
            isDaytime: true, temperature: 60,
            windSpeed: '5 to 10 mph', windDirection: 'NW',
            shortForecast: '', detailedForecast: ''
          }]
        },
        tides: { station: '9418767', events: [] },
        tidalCurrents: null,
        suntimes: {
          byDate: { '2026-05-18': { civilDawn: '2026-05-18T12:30:00Z', sunrise: '2026-05-18T13:05:00Z', sunset: '2026-05-19T03:30:00Z', civilDusk: '2026-05-19T04:00:00Z' } }
        }
      }
    });
    expect(v.dataSources.buoy).toBe('live');
    expect(v.dataSources.nwsPoint).toBe('live');
    expect(v.dataSources.nwsZone).toBe('missing');
  });

  it('Trinidad future day → buoy not-applicable (forward-looking, no buoy expected)', () => {
    const v = computeVerdict({
      date: '2026-05-20',
      today: '2026-05-17',
      species: 'rockfish',
      launch: 'trinidad',
      data: {
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 6, gustKt: 8, windDirDeg: 270,
          waveHtFt: 3.5, dominantPeriodSec: 12, meanWaveDirDeg: 275,
          waterTempF: 52
        },
        ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
        tidalCurrents: null,
        suntimes: { byDate: {} }
      }
    });
    expect(v.dataSources.buoy).toBe('not-applicable');
  });

  it('Big Lagoon (not open-ocean) → buoy not-applicable even on today', () => {
    const v = computeVerdict({
      date: '2026-05-17',
      today: '2026-05-17',
      species: 'cutthroat',
      launch: 'big-lagoon',
      data: {
        ndbc46244: null, ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
        tidalCurrents: null,
        suntimes: { byDate: {} }
      }
    });
    expect(v.dataSources.buoy).toBe('not-applicable');
  });

  it('Trinidad + today + buoy missing → INCOMPLETE verdict from the live-buoy gate', () => {
    const v = computeVerdict({
      date: '2026-05-17',
      today: '2026-05-17',
      species: 'rockfish',
      launch: 'trinidad',
      data: {
        ndbc46244: null, ndbc46022: null,
        nwsZone: {
          zone: 'PZZ450',
          updated: '2026-05-17T16:00:00Z',
          periods: [{
            number: 1, name: 'REST OF TODAY', startTime: '', endTime: '',
            detailedForecast: 'NW wind 5 to 10 kt. Seas 3 ft. Wave Detail: NW 3 ft at 13 seconds.'
          }]
        },
        nwsPoint: null, tides: null,
        tidalCurrents: null,
        suntimes: { byDate: {} }
      }
    });
    expect(v.verdict).toBe('INCOMPLETE');
    expect(v.dataSources.buoy).toBe('missing');
    expect(v.reason).toMatch(/buoy 46244 unavailable/i);
  });

  it('mad-river-slough with currents data → currents=live', () => {
    const v = computeVerdict({
      date: '2026-05-17',
      today: '2026-05-17',
      species: 'surfperch',
      launch: 'mad-river-slough',
      data: {
        ndbc46244: null, ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
        tidalCurrents: {
          station: 'HUB0203',
          units: 'feet, knots',
          events: [{ time: '2026-05-17T07:28', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }]
        },
        suntimes: { byDate: {} }
      }
    });
    expect(v.dataSources.currents).toBe('live');
  });

  it('mad-river-slough without currents data → currents=missing', () => {
    const v = computeVerdict({
      date: '2026-05-17',
      today: '2026-05-17',
      species: 'surfperch',
      launch: 'mad-river-slough',
      data: {
        ndbc46244: null, ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
        tidalCurrents: null,
        suntimes: { byDate: {} }
      }
    });
    expect(v.dataSources.currents).toBe('missing');
  });

  it('trinidad (no currentStation) → currents=not-applicable even with currents data present', () => {
    const v = computeVerdict({
      date: '2026-05-17',
      today: '2026-05-17',
      species: 'rockfish',
      launch: 'trinidad',
      data: {
        ndbc46244: null, ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
        tidalCurrents: {
          station: 'HUB0203',
          units: 'feet, knots',
          events: []
        },
        suntimes: { byDate: {} }
      }
    });
    expect(v.dataSources.currents).toBe('not-applicable');
  });

  it('freshwater-lagoon: buoy and currents both not-applicable (closed-water lake)', () => {
    const v = computeVerdict({
      date: '2026-06-15',
      today: '2026-06-15',
      species: 'rainbow-trout',
      launch: 'freshwater-lagoon',
      data: {
        ndbc46244: null, ndbc46022: null, nwsZone: null,
        nwsPoint: {
          updated: '2026-06-15T15:00:00Z',
          periods: [{
            number: 1, name: 'Today',
            startTime: '2026-06-15T09:00:00-07:00',
            endTime: '2026-06-15T18:00:00-07:00',
            isDaytime: true, temperature: 65,
            windSpeed: '5 to 10 mph', windDirection: 'NW',
            shortForecast: '', detailedForecast: ''
          }]
        },
        tides: null,
        tidalCurrents: null,
        suntimes: {
          byDate: {
            '2026-06-15': {
              civilDawn: '2026-06-15T12:30:00Z',
              sunrise: '2026-06-15T13:05:00Z',
              sunset: '2026-06-16T03:30:00Z',
              civilDusk: '2026-06-16T04:00:00Z'
            }
          }
        }
      }
    });
    expect(v.dataSources.buoy).toBe('not-applicable');
    expect(v.dataSources.currents).toBe('not-applicable');
  });
});
