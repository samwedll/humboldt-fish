import type { Species, LaunchId } from '../types.js';

/**
 * Which species are realistically targeted at which launch.
 * If a user picks (species, launch) outside this map, runLegal will fail Layer 1
 * with a "wrong location for species" reason.
 */
export const speciesLaunchCompat: Record<LaunchId, Species[]> = {
  trinidad: ['rockfish', 'lingcod', 'salmon', 'surfperch', 'pacific-halibut', 'albacore-tuna', 'dungeness-crab'],
  'big-lagoon': ['cutthroat'],
  'stone-lagoon': ['cutthroat'],
  'mad-river-slough': ['surfperch', 'california-halibut', 'dungeness-crab'],
  'humboldt-bay-interior': ['surfperch', 'california-halibut', 'dungeness-crab'],
  'freshwater-lagoon': ['bluegill', 'largemouth-bass', 'rainbow-trout']
};

export function isSpeciesLaunchCompatible(species: Species, launch: LaunchId): boolean {
  return speciesLaunchCompat[launch].includes(species);
}
