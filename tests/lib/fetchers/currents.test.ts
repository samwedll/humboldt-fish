import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCurrents } from '../../../src/lib/fetchers/currents.js';

const fixture = readFileSync(resolve('tests/fixtures/currents-HUB0203.json'), 'utf-8');

describe('parseCurrents', () => {
  it('parses slack/flood/ebb events with time, type, velocity, directions', () => {
    const c = parseCurrents(JSON.parse(fixture), 'HUB0203');
    expect(c.station).toBe('HUB0203');
    expect(c.units).toMatch(/knots/);
    expect(c.events.length).toBeGreaterThan(0);

    const types = new Set(c.events.map((e) => e.type));
    expect(types.has('slack')).toBe(true);
    expect(types.has('flood')).toBe(true);
    expect(types.has('ebb')).toBe(true);
  });

  it('flood events have positive velocity, ebb events negative', () => {
    const c = parseCurrents(JSON.parse(fixture), 'HUB0203');
    const flood = c.events.find((e) => e.type === 'flood');
    const ebb = c.events.find((e) => e.type === 'ebb');
    expect(flood).toBeDefined();
    expect(ebb).toBeDefined();
    expect(flood!.velocityKt).toBeGreaterThan(0);
    expect(ebb!.velocityKt).toBeLessThan(0);
  });

  it('slack events have near-zero velocity', () => {
    const c = parseCurrents(JSON.parse(fixture), 'HUB0203');
    const slack = c.events.find((e) => e.type === 'slack');
    expect(slack).toBeDefined();
    expect(Math.abs(slack!.velocityKt)).toBeLessThan(0.1);
  });

  it('normalizes time to ISO-like (space replaced with T)', () => {
    const c = parseCurrents(JSON.parse(fixture), 'HUB0203');
    expect(c.events[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('includes meanFloodDir and meanEbbDir for every event', () => {
    const c = parseCurrents(JSON.parse(fixture), 'HUB0203');
    for (const e of c.events) {
      expect(typeof e.meanFloodDirDeg).toBe('number');
      expect(typeof e.meanEbbDirDeg).toBe('number');
    }
  });

  it('throws on unexpected payload', () => {
    expect(() => parseCurrents({}, 'HUB0203')).toThrow();
  });

  it('throws when Type is not slack/flood/ebb', () => {
    const bad = {
      current_predictions: {
        units: 'feet, knots',
        cp: [
          {
            Type: 'wat',
            Time: '2026-05-17 00:25',
            Velocity_Major: 0,
            meanFloodDir: 21,
            meanEbbDir: 197
          }
        ]
      }
    };
    expect(() => parseCurrents(bad, 'HUB0203')).toThrow();
  });
});
