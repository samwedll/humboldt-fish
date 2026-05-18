import type { Species } from '../types.js';

/**
 * Short display labels for UI pills. Kebab-case IDs are stable + URL-friendly,
 * but make for bulky pill buttons on mobile — these are the short forms.
 */
export const SPECIES_LABEL: Record<Species, string> = {
  rockfish: 'rockfish',
  lingcod: 'lingcod',
  salmon: 'salmon',
  surfperch: 'surfperch',
  cutthroat: 'cutthroat',
  'california-halibut': 'CA halibut',
  'dungeness-crab': 'crab',
  'pacific-halibut': 'Pac halibut',
  'albacore-tuna': 'albacore',
  bluegill: 'bluegill',
  'largemouth-bass': 'bass',
  'rainbow-trout': 'trout'
};
