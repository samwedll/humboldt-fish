import { describe, it, expect, vi } from 'vitest';
import { cachedFetch } from '../../../src/lib/fetchers/cache.js';

function mkResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

describe('cachedFetch', () => {
  it('returns response from network and writes to cache on first call', async () => {
    const cacheGet = vi.fn().mockResolvedValue(undefined);
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheMock = { match: cacheGet, put: cachePut } as unknown as Cache;
    const fetchMock = vi.fn().mockResolvedValue(mkResponse('hello'));
    const res = await cachedFetch('https://example.com', { ttlSec: 60 }, fetchMock, cacheMock);
    expect(await res.text()).toBe('hello');
    expect(cacheGet).toHaveBeenCalledOnce();
    expect(cachePut).toHaveBeenCalledOnce();
  });

  it('returns cached response without calling fetch when cache hits', async () => {
    const cached = mkResponse('cached!');
    const cacheGet = vi.fn().mockResolvedValue(cached);
    const cachePut = vi.fn();
    const cacheMock = { match: cacheGet, put: cachePut } as unknown as Cache;
    const fetchMock = vi.fn();
    const res = await cachedFetch('https://example.com', { ttlSec: 60 }, fetchMock, cacheMock);
    expect(await res.text()).toBe('cached!');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bypasses cache when bypass=true', async () => {
    const cached = mkResponse('cached!');
    const cacheGet = vi.fn().mockResolvedValue(cached);
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheMock = { match: cacheGet, put: cachePut } as unknown as Cache;
    const fetchMock = vi.fn().mockResolvedValue(mkResponse('fresh!'));
    const res = await cachedFetch(
      'https://example.com',
      { ttlSec: 60, bypass: true },
      fetchMock,
      cacheMock
    );
    expect(await res.text()).toBe('fresh!');
    expect(cacheGet).not.toHaveBeenCalled();
    expect(cachePut).toHaveBeenCalledOnce();
  });
});
