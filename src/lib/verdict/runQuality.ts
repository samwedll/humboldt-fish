import type { FetchedData, LayerResult, Check, Species, LaunchId } from '../types.js';
import { formatPacificTime } from '../format.js';

export interface QualityInput {
  species: Species;
  launch: LaunchId;
  date: string;
  data: FetchedData;
}
export interface QualityOutput {
  result: LayerResult;
  checks: Check[];
}

function findMorningSlack(
  tideEvents: Array<{ time: string; type: 'H' | 'L' }>,
  date: string
): string | undefined {
  const morning = tideEvents.filter((e) => {
    const [d, t] = e.time.split('T');
    if (d !== date) return false;
    const hr = Number(t.slice(0, 2));
    return hr >= 4 && hr <= 10;
  });
  return morning[0]?.time;
}

interface SlackContext {
  applicable: boolean;  // false → suppress the Morning slack check entirely
  note: string;
}

/**
 * Decide whether the Morning slack tide check applies for this species+launch
 * combo, and what the operational note should say.
 *
 * - Freshwater Lagoon: no tide influence at all (purely freshwater).
 * - Big/Stone Lagoon: brackish but the sandbar is usually closed; tide note
 *   is too misleading to surface for cutthroat trips.
 * - Tidal saltwater (Trinidad, slough, bay): species-specific guidance.
 */
function getSlackContext(species: Species, launch: LaunchId): SlackContext {
  if (launch === 'freshwater-lagoon') {
    return { applicable: false, note: '' };
  }
  if (launch === 'big-lagoon' || launch === 'stone-lagoon') {
    return { applicable: false, note: '' };
  }

  switch (species) {
    case 'rockfish':
    case 'lingcod':
      return {
        applicable: true,
        note: 'Rockfish/lingcod prefer the slack-to-flooding transition over structure.'
      };
    case 'salmon':
      return {
        applicable: true,
        note: 'Salmon trolling is tide-agnostic; informational only.'
      };
    case 'california-halibut':
      return {
        applicable: true,
        note: 'CA halibut chase smelt into bay channels on the flood; slack high through early ebb is the peak window.'
      };
    case 'pacific-halibut':
      return {
        applicable: true,
        note: 'Pacific halibut bite is depth-driven more than tide-driven; slack helps drift presentation on the sand.'
      };
    case 'surfperch':
      return {
        applicable: true,
        note: 'Surfperch follow the incoming tide as sand crabs and bait get pushed onto the bar.'
      };
    case 'dungeness-crab':
      return {
        applicable: true,
        note: 'Hoop-net crabbing prefers slack — strong current pulls nets and washes bait scent out fast.'
      };
    case 'albacore-tuna':
      return {
        applicable: true,
        note: 'Tuna are offshore pelagic; tide stage at the launch is informational only.'
      };
    // Freshwater species are filtered out by the launch check above, but keep
    // exhaustive coverage so future Species additions force a decision here.
    case 'cutthroat':
    case 'bluegill':
    case 'largemouth-bass':
    case 'rainbow-trout':
      return { applicable: false, note: '' };
  }
}

export function runQuality({ species, launch, date, data }: QualityInput): QualityOutput {
  const checks: Check[] = [];
  const slackCtx = getSlackContext(species, launch);

  // Morning slack check: skip entirely when not applicable to this species/launch.
  if (slackCtx.applicable) {
    if (!data.tides) {
      checks.push({
        layer: 'quality',
        name: 'Tide stage',
        value: 'unavailable',
        threshold: 'morning slack preferred',
        status: 'unknown',
        note: slackCtx.note
      });
    } else {
      const slack = findMorningSlack(data.tides.events, date);
      checks.push({
        layer: 'quality',
        name: 'Morning slack',
        value: slack ? `${slack.slice(11, 16)} PT` : 'none in 04:00–10:00 PT',
        threshold: 'morning slack preferred',
        status: 'pass',
        note: slackCtx.note
      });
    }
  }

  const sun = data.suntimes.byDate[date];
  if (sun) {
    checks.push({
      layer: 'quality',
      name: 'Daylight window',
      value: `${formatPacificTime(sun.sunrise)} – ${formatPacificTime(sun.sunset)}`,
      threshold: '—',
      status: 'pass',
      note: `Civil dawn ${formatPacificTime(sun.civilDawn)}, civil dusk ${formatPacificTime(sun.civilDusk)}`
    });
  }

  return { result: { status: 'pass', summary: 'Quality acceptable' }, checks };
}
