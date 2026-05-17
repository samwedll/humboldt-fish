import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNwsPointMeta, parseNwsPointForecast } from '../../../src/lib/fetchers/nws-point.js';

const meta = readFileSync(resolve('tests/fixtures/nws-point-meta.json'), 'utf-8');
const fc = readFileSync(resolve('tests/fixtures/nws-point-forecast.json'), 'utf-8');

describe('parseNwsPointMeta', () => {
  it('extracts the forecast URL', () => {
    const m = parseNwsPointMeta(JSON.parse(meta));
    expect(m.forecastUrl).toMatch(/^https:\/\/api\.weather\.gov\/gridpoints\//);
  });
});

describe('parseNwsPointForecast', () => {
  it('extracts periods with wind speed strings and isDaytime', () => {
    const f = parseNwsPointForecast(JSON.parse(fc));
    expect(f.periods.length).toBeGreaterThan(0);
    expect(typeof f.periods[0].windSpeed).toBe('string');
    expect(typeof f.periods[0].isDaytime).toBe('boolean');
  });
});
