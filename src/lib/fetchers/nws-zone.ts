import { z } from 'zod';
import type { NwsZoneForecast, NwsZonePeriod } from '../types.js';
import type { FetchResult } from './ndbc.js';

// NWS deprecated structured marine zone forecasts (api.weather.gov/zones/forecast/PZZxxx/forecast
// now returns 404 "Marine Forecast Not Supported"). The canonical alternative is the CWF
// (Coastal Waters Forecast) text product, which carries multiple zones in one body.
// This parser pulls a single zone's section out of the product text.
const ProductSchema = z.object({
  issuanceTime: z.string(),
  productCode: z.string(),
  productText: z.string()
});

// Split the product into zone sections delimited by `$$`. Each section starts with a header
// line like `PZZ450-180515-` and contains period markers like `.TONIGHT...`.
function extractZoneSection(productText: string, zone: string): string | null {
  const sections = productText.split('$$');
  const head = new RegExp(`(^|\\n)${zone}[-A-Z0-9>]*-\\s*\\n`);
  for (const s of sections) {
    if (head.test(s)) return s;
  }
  return null;
}

// Parse `.NAME...body text` segments. Period names run until the next `.NAME...` marker.
function extractPeriods(section: string): NwsZonePeriod[] {
  const periodStart = /^\.([A-Z0-9 ]+)\.\.\./gm;
  const matches: { name: string; index: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = periodStart.exec(section)) !== null) {
    matches.push({ name: m[1].trim(), index: m.index, bodyStart: m.index + m[0].length });
  }

  const periods: NwsZonePeriod[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].bodyStart;
    const end = i + 1 < matches.length ? matches[i + 1].index : section.length;
    const rawBody = section.slice(start, end).trim();
    if (matches[i].name === 'SYNOPSIS' || matches[i].name.startsWith('SYNOPSIS')) continue;
    const detailedForecast = rawBody.replace(/\s+/g, ' ').trim();
    if (!detailedForecast) continue;
    periods.push({
      number: periods.length + 1,
      name: matches[i].name,
      startTime: '',
      endTime: '',
      detailedForecast
    });
  }
  return periods;
}

export function parseNwsZone(raw: unknown, zone: string): NwsZoneForecast {
  const v = ProductSchema.parse(raw);
  const section = extractZoneSection(v.productText, zone);
  if (!section) {
    throw new Error(`Zone ${zone} not found in CWF product`);
  }
  const periods = extractPeriods(section);
  if (periods.length === 0) {
    throw new Error(`No periods extracted from zone ${zone}`);
  }

  // Surface warning headlines (e.g. ...GALE WARNING...) by prepending to the first period.
  const headlineMatch = section.match(/\.\.\.([^.]+?)\.\.\./);
  if (headlineMatch && /WARNING|ADVISORY|WATCH/i.test(headlineMatch[1])) {
    periods[0] = {
      ...periods[0],
      detailedForecast: `${headlineMatch[1].trim()}. ${periods[0].detailedForecast}`
    };
  }

  return {
    zone,
    updated: v.issuanceTime,
    periods
  };
}

const HEADERS = {
  'User-Agent': 'humboldt.fish (https://humboldt.fish)',
  Accept: 'application/ld+json'
};

const ProductListSchema = z.object({
  '@graph': z
    .array(
      z.object({
        '@id': z.string(),
        id: z.string(),
        issuanceTime: z.string()
      })
    )
    .min(1)
});

export async function fetchNwsZone(
  zone: string,
  office: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<NwsZoneForecast>> {
  const fetchedAt = new Date().toISOString();
  try {
    const listRes = await fetchImpl(
      `https://api.weather.gov/products/types/CWF/locations/${office}`,
      { headers: HEADERS }
    );
    if (!listRes.ok) return { ok: false, error: `CWF list HTTP ${listRes.status}`, fetchedAt };
    const listJson = ProductListSchema.parse(await listRes.json());
    const latest = listJson['@graph'][0];

    const prodRes = await fetchImpl(latest['@id'], { headers: HEADERS });
    if (!prodRes.ok) return { ok: false, error: `CWF product HTTP ${prodRes.status}`, fetchedAt };
    const data = parseNwsZone(await prodRes.json(), zone);
    return { ok: true, data, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
