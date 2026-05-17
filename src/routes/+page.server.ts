import type { PageServerLoad } from './$types';
import type { VerdictResponse } from '$lib/types.js';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const species = url.searchParams.get('species') ?? 'rockfish';
  const launch = url.searchParams.get('launch') ?? 'trinidad';
  const refresh = url.searchParams.get('refresh') === 'true';
  const qs = new URLSearchParams({ species, launch, days: '7' });
  if (refresh) qs.set('refresh', 'true');
  const res = await fetch(`/api/verdict?${qs.toString()}`);
  if (!res.ok) {
    return { error: `Verdict service returned ${res.status}`, response: null as VerdictResponse | null };
  }
  const response = (await res.json()) as VerdictResponse;
  return { error: null, response };
};
