import { describe, it, expect } from 'vitest';
import { runQuality } from '../../../src/lib/verdict/runQuality.js';
import type { FetchedData } from '../../../src/lib/types.js';

function baseData(): FetchedData {
  return {
    ndbc46244: null,
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: null,
    tides: {
      station: '9418767',
      events: [
        { time: '2026-05-18T04:32:00', height: -0.5, type: 'L' },
        { time: '2026-05-18T11:05:00', height: 5.8, type: 'H' },
        { time: '2026-05-18T17:42:00', height: 1.2, type: 'L' },
        { time: '2026-05-18T23:51:00', height: 4.9, type: 'H' }
      ]
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

describe('runQuality', () => {
  it('returns pass with morning slack time noted', () => {
    const r = runQuality({ species: 'rockfish', date: '2026-05-18', data: baseData() });
    expect(['pass', 'warn']).toContain(r.result.status);
    expect(r.checks.find((c) => c.name === 'Morning slack')).toBeDefined();
  });

  it('salmon target ignores tide stage', () => {
    const r = runQuality({ species: 'salmon', date: '2026-05-18', data: baseData() });
    expect(r.result.status).toBe('pass');
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack?.note).toContain('Salmon trolling');
  });

  it('missing tide data → incomplete', () => {
    const data = baseData();
    data.tides = null;
    const r = runQuality({ species: 'rockfish', date: '2026-05-18', data });
    expect(r.result.status).toBe('incomplete');
  });
});
