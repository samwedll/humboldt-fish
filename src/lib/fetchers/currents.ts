import { z } from 'zod';
import type { TidalCurrents, TidalCurrentEventType } from '../types.js';
import type { FetchResult } from './ndbc.js';

/**
 * NOAA tidal currents predictions (max_slack interval).
 *
 * Endpoint: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
 *   product=currents_predictions
 *   interval=max_slack
 *
 * Response shape (verified live against HUB0203):
 *   { current_predictions: { units: "feet, knots", cp: [
 *     { Type: "slack"|"ebb"|"flood",
 *       Time: "YYYY-MM-DD HH:MM",
 *       Velocity_Major: signed knots (positive=flood, negative=ebb, ~0=slack),
 *       meanFloodDir: degrees true,
 *       meanEbbDir: degrees true,
 *       Bin, Depth ... } ] } }
 */
const CurrentsSchema = z.object({
  current_predictions: z.object({
    units: z.string(),
    cp: z.array(
      z.object({
        Type: z.enum(['slack', 'flood', 'ebb']),
        Time: z.string(),
        Velocity_Major: z.number(),
        meanFloodDir: z.number(),
        meanEbbDir: z.number()
      })
    )
  })
});

export function parseCurrents(raw: unknown, station: string): TidalCurrents {
  const v = CurrentsSchema.parse(raw);
  const cp = v.current_predictions;
  return {
    station,
    units: cp.units,
    events: cp.cp.map((e) => ({
      time: e.Time.replace(' ', 'T'),
      type: e.Type as TidalCurrentEventType,
      velocityKt: e.Velocity_Major,
      meanFloodDirDeg: e.meanFloodDir,
      meanEbbDirDeg: e.meanEbbDir
    }))
  };
}

export async function fetchCurrents(
  url: string,
  station: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<TidalCurrents>> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'humboldt.fish' } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    const json = await res.json();
    return { ok: true, data: parseCurrents(json, station), fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
