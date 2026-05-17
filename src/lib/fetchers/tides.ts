import { z } from 'zod';
import type { TidePredictions } from '../types.js';
import type { FetchResult } from './ndbc.js';

const TidesSchema = z.object({
  predictions: z.array(
    z.object({
      t: z.string(),
      v: z.string(),
      type: z.enum(['H', 'L'])
    })
  )
});

export function parseTides(raw: unknown, station: string): TidePredictions {
  const v = TidesSchema.parse(raw);
  return {
    station,
    events: v.predictions.map((p) => ({
      time: p.t.replace(' ', 'T'),
      height: Number(p.v),
      type: p.type
    }))
  };
}

export async function fetchTides(
  url: string,
  station: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<TidePredictions>> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'humboldt.fish' } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    const json = await res.json();
    return { ok: true, data: parseTides(json, station), fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}

export function toApiDate(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}
