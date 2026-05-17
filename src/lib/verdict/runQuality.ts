import type { FetchedData, LayerResult, Check, Species } from '../types.js';

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

  checks.push({
    layer: 'quality',
    name: 'Morning slack',
    value: slack ? slack.slice(11, 16) : 'none in 04:00–10:00',
    threshold: 'morning slack preferred',
    status: 'pass',
    note: slackNote
  });

  const sun = data.suntimes.byDate[date];
  if (sun) {
    checks.push({
      layer: 'quality',
      name: 'Daylight window',
      value: `${sun.sunrise.slice(11, 16)}Z – ${sun.sunset.slice(11, 16)}Z`,
      threshold: '—',
      status: 'pass',
      note: `Civil dawn ${sun.civilDawn.slice(11, 16)}Z, civil dusk ${sun.civilDusk.slice(11, 16)}Z`
    });
  }

  return { result: { status: 'pass', summary: 'Quality acceptable' }, checks };
}
