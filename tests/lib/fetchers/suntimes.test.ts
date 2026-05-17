import { describe, it, expect } from 'vitest';
import { computeSunTimes } from '../../../src/lib/fetchers/suntimes.js';

describe('computeSunTimes (Trinidad ~41.06°N, -124.14°W)', () => {
  it('returns civilDawn/sunrise/sunset/civilDusk ISO strings for each date', () => {
    const dates = ['2026-05-17', '2026-05-18', '2026-05-19'];
    const out = computeSunTimes(dates, 41.0586, -124.1431);
    for (const d of dates) {
      expect(out.byDate[d]).toBeDefined();
      expect(out.byDate[d].sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(out.byDate[d].sunset).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(out.byDate[d].civilDawn < out.byDate[d].sunrise).toBe(true);
      expect(out.byDate[d].sunset < out.byDate[d].civilDusk).toBe(true);
    }
  });

  it('May Trinidad sunrise is roughly 06:00 PDT (13:00 UTC ± 1h)', () => {
    const out = computeSunTimes(['2026-05-17'], 41.0586, -124.1431);
    const sr = new Date(out.byDate['2026-05-17'].sunrise);
    expect(sr.getUTCHours()).toBeGreaterThanOrEqual(12);
    expect(sr.getUTCHours()).toBeLessThanOrEqual(14);
  });
});
