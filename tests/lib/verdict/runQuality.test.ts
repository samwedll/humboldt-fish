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
  it('rockfish at Trinidad: morning slack check present with rockfish/lingcod note', () => {
    const r = runQuality({ species: 'rockfish', launch: 'trinidad', date: '2026-05-18', data: baseData() });
    expect(r.result.status).toBe('pass');
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack).toBeDefined();
    expect(slack!.note).toMatch(/slack-to-flooding/i);
  });

  it('salmon at Trinidad: tide note is tide-agnostic', () => {
    const r = runQuality({ species: 'salmon', launch: 'trinidad', date: '2026-05-18', data: baseData() });
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack?.note).toMatch(/tide-agnostic/i);
  });

  it('missing tide data: Morning slack reports unknown but Quality layer still passes', () => {
    const data = baseData();
    data.tides = null;
    const r = runQuality({ species: 'rockfish', launch: 'trinidad', date: '2026-05-18', data });
    expect(r.result.status).toBe('pass');
    const slack = r.checks.find((c) => c.name === 'Tide stage' || c.name === 'Morning slack');
    expect(slack?.status).toBe('unknown');
  });

  it('CA halibut at Humboldt Bay: tide note mentions flood + bay channels', () => {
    const r = runQuality({ species: 'california-halibut', launch: 'humboldt-bay-interior', date: '2026-05-18', data: baseData() });
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack?.note).toMatch(/halibut/i);
    expect(slack?.note).toMatch(/flood|channels/i);
    expect(slack?.note).not.toMatch(/rockfish|lingcod/i);
  });

  it('surfperch at slough: tide note mentions incoming tide + sand crabs', () => {
    const r = runQuality({ species: 'surfperch', launch: 'mad-river-slough', date: '2026-05-18', data: baseData() });
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack?.note).toMatch(/incoming/i);
    expect(slack?.note).not.toMatch(/rockfish|lingcod/i);
  });

  it('Dungeness crab at the bay: tide note prefers slack (gear-driven)', () => {
    const r = runQuality({ species: 'dungeness-crab', launch: 'humboldt-bay-interior', date: '2026-05-18', data: baseData() });
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack?.note).toMatch(/slack/i);
    expect(slack?.note).toMatch(/hoop|current/i);
  });

  it('rainbow-trout at Freshwater Lagoon: Morning slack check is suppressed (no tide)', () => {
    const r = runQuality({ species: 'rainbow-trout', launch: 'freshwater-lagoon', date: '2026-05-18', data: baseData() });
    expect(r.checks.find((c) => c.name === 'Morning slack')).toBeUndefined();
    expect(r.checks.find((c) => c.name === 'Tide stage')).toBeUndefined();
  });

  it('bluegill at Freshwater Lagoon: Morning slack check is suppressed', () => {
    const r = runQuality({ species: 'bluegill', launch: 'freshwater-lagoon', date: '2026-05-18', data: baseData() });
    expect(r.checks.find((c) => c.name === 'Morning slack')).toBeUndefined();
  });

  it('cutthroat at Big Lagoon: Morning slack check is suppressed (sandbar usually closed)', () => {
    const r = runQuality({ species: 'cutthroat', launch: 'big-lagoon', date: '2026-05-18', data: baseData() });
    expect(r.checks.find((c) => c.name === 'Morning slack')).toBeUndefined();
  });
});
