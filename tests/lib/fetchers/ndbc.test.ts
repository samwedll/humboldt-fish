import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNdbc } from '../../../src/lib/fetchers/ndbc.js';

const may17 = readFileSync(resolve('tests/fixtures/ndbc-46244-2026-05-17.txt'), 'utf-8');
const calm = readFileSync(resolve('tests/fixtures/ndbc-46244-calm.txt'), 'utf-8');

describe('parseNdbc', () => {
  it('parses the May 17 dangerous reading (10.5 ft @ 11s WNW)', () => {
    const obs = parseNdbc(may17);
    expect(obs).not.toBeNull();
    expect(obs!.waveHtFt).toBeCloseTo(10.5, 1);
    expect(obs!.dominantPeriodSec).toBe(11.0);
    expect(obs!.windDirDeg).toBe(290);
    expect(obs!.meanWaveDirDeg).toBe(295);
  });

  it('parses the calm fixture', () => {
    const obs = parseNdbc(calm);
    expect(obs).not.toBeNull();
    expect(obs!.waveHtFt).toBeCloseTo(3.6, 1);
    expect(obs!.dominantPeriodSec).toBe(12.0);
    expect(obs!.windKt).toBeCloseTo(5.8, 1);
  });

  it('handles MM (missing) values as null', () => {
    const obs = parseNdbc(may17);
    expect(obs!.waterTempF).not.toBeNull();
  });

  it('returns null for an empty response', () => {
    expect(parseNdbc('')).toBeNull();
  });
});
