import { describe, it, expect } from 'vitest';
import { runSafety } from '../../../src/lib/verdict/runSafety.js';
import type { FetchedData } from '../../../src/lib/types.js';

function calmBuoyData(overrides: Partial<FetchedData> = {}): FetchedData {
  return {
    ndbc46244: {
      observedAt: '2026-05-17T14:00:00Z',
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
    tides: null,
    suntimes: { byDate: {} },
    ...overrides
  };
}

function nwsZoneFixture(periods: Array<{ name: string; detailedForecast: string }>) {
  return {
    zone: 'PZZ450',
    updated: '2026-05-17T16:03:00Z',
    periods: periods.map((p, i) => ({
      number: i + 1,
      name: p.name,
      startTime: '',
      endTime: '',
      detailedForecast: p.detailedForecast
    }))
  };
}

describe('runSafety — today (buoy path)', () => {
  it('all-green calm-day buoy data → pass', () => {
    const r = runSafety({ date: '2026-05-17', launch: 'trinidad', data: calmBuoyData() });
    expect(r.result.status).toBe('pass');
  });

  it('THE MAY 17 CASE: buoy 10.5 ft @ 11s WNW → fail (swell)', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 12,
          gustKt: 16,
          windDirDeg: 290,
          waveHtFt: 10.5,
          dominantPeriodSec: 11,
          meanWaveDirDeg: 295,
          waterTempF: 51.8
        }
      })
    });
    expect(r.result.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Swell height')?.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Wind gust')?.status).toBe('fail');
  });

  it('sustained wind 16 kt → fail', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 16,
          gustKt: 18,
          windDirDeg: 270,
          waveHtFt: 3,
          dominantPeriodSec: 12,
          meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
  });

  it('swell period 9 sec → fail', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 6,
          gustKt: 8,
          windDirDeg: 270,
          waveHtFt: 3.5,
          dominantPeriodSec: 9,
          meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
  });

  it('wind 13 kt (within 20% of 15 kt) → warn', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 13,
          gustKt: 14,
          windDirDeg: 270,
          waveHtFt: 3,
          dominantPeriodSec: 12,
          meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    const wind = r.checks.find((c) => c.name === 'Sustained wind');
    expect(wind?.status).toBe('warn');
  });

  it('opposing wind/swell (>45° apart) → fail', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 8,
          gustKt: 10,
          windDirDeg: 90,
          waveHtFt: 3,
          dominantPeriodSec: 12,
          meanWaveDirDeg: 270,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Wind/swell alignment')?.status).toBe('fail');
  });
});

describe('runSafety — future days (NWS prose path)', () => {
  it('MON forecast: 25 kt wind gusting 35, 8 ft seas → fail', () => {
    const r = runSafety({
      date: '2026-05-18',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: null,
        nwsZone: nwsZoneFixture([
          {
            name: 'REST OF TODAY',
            detailedForecast:
              'N wind 25 to 30 kt with gusts up to 40 kt. Seas 10 ft. Wave Detail: NW 9 ft at 8 seconds.'
          },
          { name: 'TONIGHT', detailedForecast: 'N wind 25 to 30 kt. Seas 11 ft.' },
          {
            name: 'MON',
            detailedForecast:
              'N wind 20 to 25 kt with gusts up to 35 kt. Seas 8 ft. Wave Detail: NW 8 ft at 9 seconds and NW 2 ft at 17 seconds.'
          }
        ])
      })
    });
    expect(r.result.status).toBe('fail');
  });

  it('TUE forecast: 15-20 kt wind, 4 ft seas, 12s period → pass (high-end wind exactly at 20 vs 15kt threshold = fail actually)', () => {
    // 15-20 kt range -> high end 20 kt -> over 15 kt threshold -> fail
    const r = runSafety({
      date: '2026-05-19',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: null,
        nwsZone: nwsZoneFixture([
          { name: 'REST OF TODAY', detailedForecast: '' },
          { name: 'TONIGHT', detailedForecast: '' },
          { name: 'MON', detailedForecast: '' },
          { name: 'MON NIGHT', detailedForecast: '' },
          {
            name: 'TUE',
            detailedForecast: 'NW wind 15 to 20 kt. Seas 4 ft. Wave Detail: NW 4 ft at 12 seconds.'
          }
        ])
      })
    });
    expect(r.result.status).toBe('fail'); // 20 kt > 15 kt threshold
  });

  it('all-green NWS day: 8 kt wind, 3 ft seas, 13s period → pass', () => {
    const r = runSafety({
      date: '2026-05-19',
      launch: 'trinidad',
      data: calmBuoyData({
        ndbc46244: null,
        nwsZone: nwsZoneFixture([
          { name: 'REST OF TODAY', detailedForecast: '' },
          { name: 'TONIGHT', detailedForecast: '' },
          { name: 'MON', detailedForecast: '' },
          { name: 'MON NIGHT', detailedForecast: '' },
          {
            name: 'TUE',
            detailedForecast: 'NW wind 5 to 10 kt. Seas 3 ft. Wave Detail: NW 3 ft at 13 seconds.'
          }
        ])
      })
    });
    expect(r.result.status).toBe('pass');
  });

  it('no NWS data and no buoy → incomplete', () => {
    const r = runSafety({
      date: '2026-05-19',
      launch: 'trinidad',
      data: calmBuoyData({ ndbc46244: null })
    });
    expect(r.result.status).toBe('incomplete');
  });
});

describe('runSafety — protected-water launches (per-launch profile)', () => {
  it('big-lagoon with calm buoy → pass (wind only)', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: calmBuoyData()
    });
    expect(r.result.status).toBe('pass');
    // No swell/period/alignment/water-temp checks for lagoons
    expect(r.checks.find((c) => c.name === 'Swell height')).toBeUndefined();
    expect(r.checks.find((c) => c.name === 'Swell period')).toBeUndefined();
    expect(r.checks.find((c) => c.name === 'Wind/swell alignment')).toBeUndefined();
    expect(r.checks.find((c) => c.name === 'Water temp')).toBeUndefined();
  });

  it('big-lagoon with 16 kt wind → fail (wind alone)', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 16,
          gustKt: 18,
          windDirDeg: 270,
          waveHtFt: 3,
          dominantPeriodSec: 12,
          meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Sustained wind')?.status).toBe('fail');
  });

  it('big-lagoon with 10.5 ft swell + 6 kt wind → pass (lagoon skips swell)', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 6,
          gustKt: 8,
          windDirDeg: 270,
          waveHtFt: 10.5,
          dominantPeriodSec: 11,
          meanWaveDirDeg: 295,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('pass');
  });

  it('humboldt-bay-interior with 8 kt wind → pass (no swell checks for bay interior)', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'humboldt-bay-interior',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 8,
          gustKt: 10,
          windDirDeg: 270,
          waveHtFt: 4,
          dominantPeriodSec: 12,
          meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('pass');
    expect(r.checks.find((c) => c.name === 'Swell height')).toBeUndefined();
  });

  it('mad-river-slough with 5 kt wind → pass', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'mad-river-slough',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 5,
          gustKt: 7,
          windDirDeg: 270,
          waveHtFt: 8,
          dominantPeriodSec: 9,
          meanWaveDirDeg: 90,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('pass');
  });
});

describe('runSafety — point-forecast wind (location-aware)', () => {
  function pointFixture(periods: Array<{ startTime: string; isDaytime: boolean; windSpeed: string; windDirection: string }>) {
    return {
      updated: '2026-05-17T15:00:00Z',
      periods: periods.map((p, i) => ({
        number: i + 1,
        name: 'Today',
        startTime: p.startTime,
        endTime: p.startTime,
        isDaytime: p.isDaytime,
        temperature: 60,
        windSpeed: p.windSpeed,
        windDirection: p.windDirection,
        shortForecast: '',
        detailedForecast: ''
      }))
    };
  }

  it('big-lagoon with buoy-wind-MM + point forecast 8 mph → pass', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: null, gustKt: null, windDirDeg: null,
          waveHtFt: 10.5, dominantPeriodSec: 11, meanWaveDirDeg: 295,
          waterTempF: 52
        },
        nwsPoint: pointFixture([
          { startTime: '2026-05-17T09:00:00-07:00', isDaytime: true, windSpeed: '5 to 10 mph', windDirection: 'NW' }
        ])
      })
    });
    expect(r.result.status).toBe('pass');
    expect(r.checks.find((c) => c.name === 'Sustained wind')?.note).toMatch(/point forecast/i);
  });

  it('big-lagoon with point forecast 25 mph → fail', () => {
    const r = runSafety({
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: null, gustKt: null, windDirDeg: null,
          waveHtFt: 3, dominantPeriodSec: 12, meanWaveDirDeg: 270,
          waterTempF: 52
        },
        nwsPoint: pointFixture([
          { startTime: '2026-05-17T09:00:00-07:00', isDaytime: true, windSpeed: '20 to 25 mph', windDirection: 'N' }
        ])
      })
    });
    expect(r.result.status).toBe('fail');
  });

  it('point forecast takes precedence over buoy wind for inland launches', () => {
    // Buoy says 5 kt (deceptively calm bay reading), but point forecast for lagoon says 20 kt
    const r = runSafety({
      date: '2026-05-17',
      launch: 'big-lagoon',
      data: calmBuoyData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 5, gustKt: 7, windDirDeg: 270,
          waveHtFt: 3, dominantPeriodSec: 12, meanWaveDirDeg: 270,
          waterTempF: 52
        },
        nwsPoint: pointFixture([
          { startTime: '2026-05-17T09:00:00-07:00', isDaytime: true, windSpeed: '20 mph', windDirection: 'N' }
        ])
      })
    });
    expect(r.result.status).toBe('fail');
    const windCheck = r.checks.find((c) => c.name === 'Sustained wind');
    expect(windCheck?.note).toMatch(/point forecast/i);
  });
});
