import type { Species, LaunchId } from './types.js';
import { speciesLaunchCompat } from './config/species-launch.js';
import { launches } from './config/launches.js';

export function parseRulesParams(search: string): { launch: LaunchId; species: Species } {
  const q = new URLSearchParams(search);
  const launchParam = q.get('launch');
  const launch: LaunchId = launchParam && launchParam in launches ? (launchParam as LaunchId) : 'trinidad';
  const valid = speciesLaunchCompat[launch];
  const speciesParam = q.get('species') as Species | null;
  const species: Species = speciesParam && valid.includes(speciesParam) ? speciesParam : valid[0];
  return { launch, species };
}
