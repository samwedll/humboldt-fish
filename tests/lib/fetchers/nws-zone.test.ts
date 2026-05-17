import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNwsZone } from '../../../src/lib/fetchers/nws-zone.js';

const fixture = readFileSync(resolve('tests/fixtures/nws-pzz450.json'), 'utf-8');

describe('parseNwsZone', () => {
  it('extracts zone code, updated time, and periods for PZZ450', () => {
    const parsed = parseNwsZone(JSON.parse(fixture), 'PZZ450');
    expect(parsed.zone).toBe('PZZ450');
    expect(parsed.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.periods.length).toBeGreaterThan(0);
    const p0 = parsed.periods[0];
    expect(typeof p0.detailedForecast).toBe('string');
    expect(p0.detailedForecast.length).toBeGreaterThan(0);
    expect(p0.name).toMatch(/REST OF TODAY|TODAY|TONIGHT|MON|TUE|WED|THU|FRI|SAT|SUN/);
  });

  it('captures gale warning headline in the first period when present', () => {
    const parsed = parseNwsZone(JSON.parse(fixture), 'PZZ450');
    const allText = parsed.periods.map((p) => p.detailedForecast).join(' ');
    expect(allText.toUpperCase()).toContain('GALE');
  });

  it('rejects payload that fails schema', () => {
    expect(() => parseNwsZone({ properties: {} }, 'PZZ450')).toThrow();
  });

  it('throws when the requested zone is not in the product', () => {
    expect(() => parseNwsZone(JSON.parse(fixture), 'PZZ999')).toThrow();
  });
});
