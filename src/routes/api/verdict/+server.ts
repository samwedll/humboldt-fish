import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { orchestrateVerdict } from '$lib/server/orchestrate.js';
import { sources, USER_AGENT } from '$lib/config/sources.js';
import { fetchNdbc } from '$lib/fetchers/ndbc.js';
import { fetchNwsZone } from '$lib/fetchers/nws-zone.js';
import { fetchNwsPoint } from '$lib/fetchers/nws-point.js';
import { fetchTides, toApiDate } from '$lib/fetchers/tides.js';
import { fetchCurrents } from '$lib/fetchers/currents.js';
import { computeSunTimes } from '$lib/fetchers/suntimes.js';
import { cachedFetch } from '$lib/fetchers/cache.js';
import { getLaunch } from '$lib/config/launches.js';

const SPECIES = [
  'rockfish', 'lingcod', 'salmon', 'surfperch', 'cutthroat',
  'california-halibut', 'dungeness-crab', 'pacific-halibut', 'albacore-tuna'
] as const;
type SpeciesId = (typeof SPECIES)[number];

const LAUNCHES = [
  'trinidad',
  'big-lagoon',
  'stone-lagoon',
  'mad-river-slough',
  'humboldt-bay-interior'
] as const;
type LaunchIdParam = (typeof LAUNCHES)[number];

function todayInPacific(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(new Date());
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const GET: RequestHandler = async ({ url, platform }) => {
  const speciesParam = (url.searchParams.get('species') ?? 'rockfish') as SpeciesId;
  if (!SPECIES.includes(speciesParam)) throw error(400, 'invalid species');
  const launchParam = (url.searchParams.get('launch') ?? 'trinidad') as LaunchIdParam;
  if (!LAUNCHES.includes(launchParam)) throw error(400, 'invalid launch');
  const days = Math.max(1, Math.min(7, Number(url.searchParams.get('days') ?? '7')));
  const bypass = url.searchParams.get('refresh') === 'true';

  const cache = platform?.caches?.default;
  const launchProfile = getLaunch(launchParam);

  const wrapWithCache = (urlStr: string, ttlSec: number, init?: RequestInit) =>
    async (_url?: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      cachedFetch(urlStr, { ttlSec, bypass, init }, fetch, cache);

  const fetchers = {
    ndbc46244: async () => {
      const wrap = wrapWithCache(sources.ndbc46244.url, sources.ndbc46244.ttlSec, { headers: { 'User-Agent': USER_AGENT } });
      return fetchNdbc(sources.ndbc46244.url, wrap as unknown as typeof fetch);
    },
    ndbc46022: async () => {
      const wrap = wrapWithCache(sources.ndbc46022.url, sources.ndbc46022.ttlSec, { headers: { 'User-Agent': USER_AGENT } });
      return fetchNdbc(sources.ndbc46022.url, wrap as unknown as typeof fetch);
    },
    nwsZone: async () => {
      // fetchNwsZone makes two requests internally (CWF list + detail). Wrap fetch so each URL is independently cached.
      const wrappedFetch: typeof fetch = async (input, init) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return cachedFetch(u, {
          ttlSec: sources.nwsZone.ttlSec,
          bypass,
          init: { ...init, headers: { 'User-Agent': USER_AGENT, Accept: 'application/ld+json', ...(init?.headers ?? {}) } }
        }, fetch, cache);
      };
      return fetchNwsZone(sources.nwsZone.zone, sources.nwsZone.office, wrappedFetch);
    },
    nwsPoint: async () => {
      const wrappedFetch: typeof fetch = async (input, init) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return cachedFetch(u, {
          ttlSec: sources.nwsPoint.ttlSec,
          bypass,
          init: { ...init, headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json', ...(init?.headers ?? {}) } }
        }, fetch, cache);
      };
      return fetchNwsPoint(launchProfile.coordinates.lat, launchProfile.coordinates.lon, wrappedFetch);
    },
    tides: async () => {
      const today = todayInPacific();
      const end = addDays(today, 7);
      const url2 = sources.tides.url(sources.tides.station, toApiDate(today), toApiDate(end));
      const wrap = wrapWithCache(url2, sources.tides.ttlSec, { headers: { 'User-Agent': USER_AGENT } });
      return fetchTides(url2, sources.tides.station, wrap as unknown as typeof fetch);
    },
    tidalCurrents: async () => {
      // Skip the fetch entirely if the launch has no current station.
      if (!launchProfile.currentStation) return null;
      const today = todayInPacific();
      const end = addDays(today, 7);
      const station = launchProfile.currentStation;
      const url2 = sources.currents.url(station, toApiDate(today), toApiDate(end));
      const wrap = wrapWithCache(url2, sources.currents.ttlSec, { headers: { 'User-Agent': USER_AGENT } });
      return fetchCurrents(url2, station, wrap as unknown as typeof fetch);
    },
    suntimes: (dates: string[]) =>
      computeSunTimes(dates, launchProfile.coordinates.lat, launchProfile.coordinates.lon)
  };

  const body = await orchestrateVerdict({
    species: speciesParam, launch: launchParam, days, today: todayInPacific(), fetchers
  });
  return json(body);
};
