import { describe, it, expect } from 'vitest';
import { runLogistics } from '../../../src/lib/verdict/runLogistics.js';
import type { FetchedData } from '../../../src/lib/types.js';

function data(): FetchedData {
  return {
    ndbc46244: null,
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: null,
    tides: null,
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
});
