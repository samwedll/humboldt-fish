import { describe, it, expect } from 'vitest';
import { sources } from '../../../src/lib/config/sources.js';

describe('sources', () => {
  it('uses PZZ450, not PZZ455', () => {
    expect(sources.nwsZone.zone).toBe('PZZ450');
  });
  it('NDBC 46244 is the primary buoy', () => {
    expect(sources.ndbc46244.url).toBe('https://www.ndbc.noaa.gov/data/realtime2/46244.txt');
  });
  it('Tides station is 9418767 (Humboldt Bay North Spit)', () => {
    expect(sources.tides.station).toBe('9418767');
  });
  it('every source has a TTL (seconds) and label', () => {
    for (const s of Object.values(sources)) {
      expect(s.ttlSec).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
