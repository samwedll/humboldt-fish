import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTides } from '../../../src/lib/fetchers/tides.js';

const fixture = readFileSync(resolve('tests/fixtures/tides-9418767.json'), 'utf-8');

describe('parseTides', () => {
  it('parses hi/lo events with time, height, and type', () => {
    const t = parseTides(JSON.parse(fixture), '9418767');
    expect(t.station).toBe('9418767');
    expect(t.events.length).toBeGreaterThan(0);
    expect(['H', 'L']).toContain(t.events[0].type);
    expect(typeof t.events[0].height).toBe('number');
  });

  it('throws on unexpected payload', () => {
    expect(() => parseTides({}, '9418767')).toThrow();
  });
});
