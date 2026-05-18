import { describe, it, expect } from 'vitest';
import { launches, getLaunch } from '../../../src/lib/config/launches.js';

describe('launches', () => {
  it('trinidad profile is defined', () => {
    const t = getLaunch('trinidad');
    expect(t.id).toBe('trinidad');
    expect(t.label).toBe('Trinidad Harbor');
    expect(t.openOcean).toBe(true);
    expect(t.requiresSwellCheck).toBe(true);
    expect(t.requiresPeriodCheck).toBe(true);
    expect(t.requiresAlignmentCheck).toBe(true);
    expect(t.requiresWindCheck).toBe(true);
    expect(t.requiresTideAwareness).toBe(false);
    expect(t.requiresBarCheck).toBe(false);
    expect(t.coordinates.lat).toBeCloseTo(41.0586, 3);
    expect(t.coordinates.lon).toBeCloseTo(-124.1431, 3);
    expect(t.ndbcBuoyPrimary).toBe('46244');
    expect(t.ndbcBuoySecondary).toBe('46022');
  });

  it('all six launches are exposed in v1.3', () => {
    expect(Object.keys(launches).sort()).toEqual(
      [
        'trinidad',
        'big-lagoon',
        'stone-lagoon',
        'mad-river-slough',
        'humboldt-bay-interior',
        'freshwater-lagoon'
      ].sort()
    );
    expect(launches.trinidad.label).toBe('Trinidad Harbor');
    expect(launches['big-lagoon'].label).toBe('Big Lagoon');
    expect(launches['stone-lagoon'].label).toBe('Stone Lagoon');
    expect(launches['mad-river-slough'].label).toBe('Mad River Slough');
    expect(launches['humboldt-bay-interior'].label).toBe('Humboldt Bay (interior)');
    expect(launches['freshwater-lagoon'].label).toBe('Freshwater Lagoon');
  });

  it('big-lagoon profile: protected water, no swell/period/alignment checks', () => {
    const l = getLaunch('big-lagoon');
    expect(l.openOcean).toBe(false);
    expect(l.requiresSwellCheck).toBe(false);
    expect(l.requiresPeriodCheck).toBe(false);
    expect(l.requiresAlignmentCheck).toBe(false);
    expect(l.requiresWindCheck).toBe(true);
    expect(l.requiresTideAwareness).toBe(false);
    expect(l.soloInYearOne).toBe(true);
    expect(l.ndbcBuoyPrimary).toBeUndefined();
  });

  it('stone-lagoon profile mirrors big-lagoon (closed-season note in markdown)', () => {
    const l = getLaunch('stone-lagoon');
    expect(l.openOcean).toBe(false);
    expect(l.requiresSwellCheck).toBe(false);
    expect(l.requiresWindCheck).toBe(true);
    expect(l.notes.toLowerCase()).toContain('spawning');
  });

  it('mad-river-slough requires tide awareness', () => {
    const l = getLaunch('mad-river-slough');
    expect(l.openOcean).toBe(false);
    expect(l.requiresSwellCheck).toBe(false);
    expect(l.requiresTideAwareness).toBe(true);
    expect(l.tideStation).toBe('9418767');
  });

  it('humboldt-bay-interior requires tide awareness and stays away from entrance', () => {
    const l = getLaunch('humboldt-bay-interior');
    expect(l.openOcean).toBe(false);
    expect(l.requiresSwellCheck).toBe(false);
    expect(l.requiresTideAwareness).toBe(true);
    expect(l.tideStation).toBe('9418767');
    expect(l.notes.toLowerCase()).toContain('entrance');
  });

  it('freshwater-lagoon: closed water, wind-only, no swell/tide/current', () => {
    const l = getLaunch('freshwater-lagoon');
    expect(l.openOcean).toBe(false);
    expect(l.requiresSwellCheck).toBe(false);
    expect(l.requiresPeriodCheck).toBe(false);
    expect(l.requiresAlignmentCheck).toBe(false);
    expect(l.requiresTideAwareness).toBe(false);
    expect(l.requiresBarCheck).toBe(false);
  });

  it('freshwater-lagoon: wind check still required (paddling on a lake)', () => {
    expect(launches['freshwater-lagoon'].requiresWindCheck).toBe(true);
  });

  it('freshwater-lagoon: no current station (closed freshwater lake)', () => {
    expect(launches['freshwater-lagoon'].currentStation).toBeUndefined();
  });

  it('freshwater-lagoon: no NDBC buoy applies', () => {
    expect(launches['freshwater-lagoon'].ndbcBuoyPrimary).toBeUndefined();
  });
});
