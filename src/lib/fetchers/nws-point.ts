import { z } from 'zod';
import type { NwsPointForecast } from '../types.js';
import type { FetchResult } from './ndbc.js';

const PointMetaSchema = z.object({
  properties: z.object({
    forecast: z.string().url(),
    forecastHourly: z.string().url().optional()
  })
});

const PointForecastSchema = z.object({
  properties: z.object({
    // api.weather.gov uses `updateTime` (older NWS examples showed `updated`).
    updateTime: z.string(),
    periods: z.array(
      z.object({
        number: z.number(),
        name: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        isDaytime: z.boolean(),
        temperature: z.number(),
        windSpeed: z.string(),
        windDirection: z.string(),
        shortForecast: z.string(),
        detailedForecast: z.string()
      })
    )
  })
});

export function parseNwsPointMeta(raw: unknown): { forecastUrl: string } {
  const v = PointMetaSchema.parse(raw);
  return { forecastUrl: v.properties.forecast };
}

export function parseNwsPointForecast(raw: unknown): NwsPointForecast {
  const v = PointForecastSchema.parse(raw);
  return {
    updated: v.properties.updateTime,
    periods: v.properties.periods
  };
}

const HEADERS = {
  'User-Agent': 'humboldt.fish (https://humboldt.fish)',
  Accept: 'application/geo+json'
};

export async function fetchNwsPoint(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<NwsPointForecast>> {
  const fetchedAt = new Date().toISOString();
  try {
    const metaRes = await fetchImpl(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: HEADERS
    });
    if (!metaRes.ok) return { ok: false, error: `points HTTP ${metaRes.status}`, fetchedAt };
    const meta = parseNwsPointMeta(await metaRes.json());

    const fcRes = await fetchImpl(meta.forecastUrl, { headers: HEADERS });
    if (!fcRes.ok) return { ok: false, error: `forecast HTTP ${fcRes.status}`, fetchedAt };
    const data = parseNwsPointForecast(await fcRes.json());
    return { ok: true, data, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
