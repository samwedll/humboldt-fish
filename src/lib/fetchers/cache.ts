export interface CacheOptions {
  ttlSec: number;
  bypass?: boolean;
  init?: RequestInit;
}

export async function cachedFetch(
  url: string,
  opts: CacheOptions,
  fetchImpl: typeof fetch = fetch,
  cache?: Cache
): Promise<Response> {
  const key = new Request(url, { method: 'GET' });
  if (cache && !opts.bypass) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await fetchImpl(url, opts.init);
  if (cache && res.ok) {
    const cacheable = new Response(res.clone().body, {
      status: res.status,
      headers: {
        ...Object.fromEntries(res.headers),
        'Cache-Control': `public, max-age=${opts.ttlSec}`
      }
    });
    await cache.put(key, cacheable);
  }
  return res;
}
