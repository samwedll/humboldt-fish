#!/usr/bin/env tsx
import { sources, USER_AGENT } from '../src/lib/config/sources.js';
import { parseNdbc } from '../src/lib/fetchers/ndbc.js';
import { fetchNwsZone } from '../src/lib/fetchers/nws-zone.js';
import { parseNwsPointMeta, parseNwsPointForecast } from '../src/lib/fetchers/nws-point.js';
import { parseTides, toApiDate } from '../src/lib/fetchers/tides.js';
import { parseCurrents } from '../src/lib/fetchers/currents.js';
import { computeSunTimes } from '../src/lib/fetchers/suntimes.js';

const HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' };

async function check(name: string, fn: () => Promise<unknown>) {
  process.stdout.write(`${name.padEnd(40)} `);
  try {
    const value = await fn();
    console.log('OK', typeof value === 'object' && value ? Object.keys(value).slice(0, 4).join(',') : '');
  } catch (e) {
    console.log('FAIL', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

await check('NDBC 46244 parse', async () => {
  const res = await fetch(sources.ndbc46244.url);
  return parseNdbc(await res.text());
});
await check('NDBC 46022 parse', async () => {
  const res = await fetch(sources.ndbc46022.url);
  return parseNdbc(await res.text());
});
await check('NWS CWF (PZZ450 via EKA) parse', async () => {
  const r = await fetchNwsZone(sources.nwsZone.zone, sources.nwsZone.office);
  if (!r.ok) throw new Error(r.error);
  return r.data;
});
await check('NWS point Trinidad parse', async () => {
  const meta = await fetch('https://api.weather.gov/points/41.0586,-124.1431', { headers: HEADERS });
  const m = parseNwsPointMeta(await meta.json());
  const fc = await fetch(m.forecastUrl, { headers: HEADERS });
  return parseNwsPointForecast(await fc.json());
});
await check('Tides 9418767 parse', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const url = sources.tides.url(sources.tides.station, toApiDate(today), toApiDate(end));
  const res = await fetch(url);
  return parseTides(await res.json(), sources.tides.station);
});
await check('NOAA tidal currents HUB0203', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const station = sources.currents.defaultStation;
  const url = sources.currents.url(station, toApiDate(today), toApiDate(end));
  const res = await fetch(url);
  return parseCurrents(await res.json(), station);
});
await check('SunCalc compute', async () => {
  return computeSunTimes(['2026-05-18'], 41.0586, -124.1431);
});
