import { describe, it, expect } from 'vitest';
import {
  speciesLaunchCompat,
  isSpeciesLaunchCompatible
} from '../../../src/lib/config/species-launch.js';

describe('speciesLaunchCompat', () => {
  it('rockfish at trinidad → compatible', () => {
    expect(isSpeciesLaunchCompatible('rockfish', 'trinidad')).toBe(true);
  });

  it('rockfish at big-lagoon → incompatible', () => {
    expect(isSpeciesLaunchCompatible('rockfish', 'big-lagoon')).toBe(false);
  });

  it('cutthroat at big-lagoon → compatible', () => {
    expect(isSpeciesLaunchCompatible('cutthroat', 'big-lagoon')).toBe(true);
  });

  it('cutthroat at stone-lagoon → compatible', () => {
    expect(isSpeciesLaunchCompatible('cutthroat', 'stone-lagoon')).toBe(true);
  });

  it('cutthroat at trinidad → incompatible', () => {
    expect(isSpeciesLaunchCompatible('cutthroat', 'trinidad')).toBe(false);
  });

  it('surfperch at humboldt-bay-interior → compatible', () => {
    expect(isSpeciesLaunchCompatible('surfperch', 'humboldt-bay-interior')).toBe(true);
  });

  it('surfperch at mad-river-slough → compatible', () => {
    expect(isSpeciesLaunchCompatible('surfperch', 'mad-river-slough')).toBe(true);
  });

  it('lingcod at humboldt-bay-interior → incompatible', () => {
    expect(isSpeciesLaunchCompatible('lingcod', 'humboldt-bay-interior')).toBe(false);
  });

  it('every launch in the map has at least one compatible species', () => {
    for (const launch of Object.keys(speciesLaunchCompat)) {
      expect(speciesLaunchCompat[launch as keyof typeof speciesLaunchCompat].length).toBeGreaterThan(0);
    }
  });

  it('california-halibut at humboldt-bay-interior → compatible', () => {
    expect(isSpeciesLaunchCompatible('california-halibut', 'humboldt-bay-interior')).toBe(true);
  });
  it('california-halibut at trinidad → incompatible (Pac halibut is the open-Pacific analog)', () => {
    expect(isSpeciesLaunchCompatible('california-halibut', 'trinidad')).toBe(false);
  });
  it('california-halibut at mad-river-slough → compatible', () => {
    expect(isSpeciesLaunchCompatible('california-halibut', 'mad-river-slough')).toBe(true);
  });

  it('pacific-halibut at trinidad → compatible', () => {
    expect(isSpeciesLaunchCompatible('pacific-halibut', 'trinidad')).toBe(true);
  });
  it('pacific-halibut at big-lagoon → incompatible', () => {
    expect(isSpeciesLaunchCompatible('pacific-halibut', 'big-lagoon')).toBe(false);
  });

  it('dungeness-crab at mad-river-slough → compatible', () => {
    expect(isSpeciesLaunchCompatible('dungeness-crab', 'mad-river-slough')).toBe(true);
  });
  it('dungeness-crab at humboldt-bay-interior → compatible', () => {
    expect(isSpeciesLaunchCompatible('dungeness-crab', 'humboldt-bay-interior')).toBe(true);
  });
  it('dungeness-crab at trinidad → compatible (hoop net at the kelp edge near the harbor)', () => {
    expect(isSpeciesLaunchCompatible('dungeness-crab', 'trinidad')).toBe(true);
  });

  it('albacore-tuna at trinidad → compatible', () => {
    expect(isSpeciesLaunchCompatible('albacore-tuna', 'trinidad')).toBe(true);
  });
  it('albacore-tuna at humboldt-bay-interior → incompatible (open-Pacific only)', () => {
    expect(isSpeciesLaunchCompatible('albacore-tuna', 'humboldt-bay-interior')).toBe(false);
  });

  it('bluegill at freshwater-lagoon → compatible', () => {
    expect(isSpeciesLaunchCompatible('bluegill', 'freshwater-lagoon')).toBe(true);
  });
  it('bluegill at trinidad → incompatible', () => {
    expect(isSpeciesLaunchCompatible('bluegill', 'trinidad')).toBe(false);
  });
  it('largemouth-bass at big-lagoon → incompatible (only Freshwater Lagoon)', () => {
    expect(isSpeciesLaunchCompatible('largemouth-bass', 'big-lagoon')).toBe(false);
  });
  it('rainbow-trout at stone-lagoon → incompatible (cutthroat is the Stone Lagoon trout)', () => {
    expect(isSpeciesLaunchCompatible('rainbow-trout', 'stone-lagoon')).toBe(false);
  });
});
