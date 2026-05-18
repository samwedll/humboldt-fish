import type { FetchedData, LayerResult, Check, Species } from '../types.js';
import { formatPacificTime } from '../format.js';

export interface QualityInput {
  species: Species;
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

export function runQuality({ species, date, data }: QualityInput): QualityOutput {
  const checks: Check[] = [];
  if (!data.tides) {
    return {
      result: { status: 'incomplete', summary: 'Tide data unavailable' },
      checks: [
        {
          layer: 'quality',
          name: 'Tide stage',
          value: 'unavailable',
          threshold: 'morning slack preferred',
          status: 'unknown'
        }
      ]
    };
  }

  const slack = findMorningSlack(data.tides.events, date);
  const slackNote =
    species === 'salmon'
      ? 'Salmon trolling is tide-agnostic; informational only.'
      : 'Rockfish/lingcod prefer slack-to-flooding transition.';

  // Tide times come back as YYYY-MM-DDTHH:MM in local Pacific time (LST/LDT
  // requested from the NOAA tides API), so we just append the "PT" label.
  checks.push({
    layer: 'quality',
    name: 'Morning slack',
    value: slack ? `${slack.slice(11, 16)} PT` : 'none in 04:00–10:00 PT',
    threshold: 'morning slack preferred',
    status: 'pass',
    note: slackNote
  });

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
