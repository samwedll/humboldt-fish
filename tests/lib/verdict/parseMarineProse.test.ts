import { describe, it, expect } from 'vitest';
import {
  parseMarineProse,
  deriveDateForPeriod
} from '../../../src/lib/verdict/parseMarineProse.js';

describe('parseMarineProse', () => {
  it('parses MON forecast: N 20-25 kt gusting 35, 8 ft seas, NW 8 ft at 9s swell', () => {
    const text =
      'N wind 20 to 25 kt with gusts up to 35 kt. Seas 8 ft. Wave Detail: NW 8 ft at 9 seconds and NW 2 ft at 17 seconds.';
    const p = parseMarineProse(text);
    expect(p.windDirAbbr).toBe('N');
    expect(p.windDirDeg).toBe(0);
    expect(p.windLowKt).toBe(20);
    expect(p.windHighKt).toBe(25);
    expect(p.gustKt).toBe(35);
    expect(p.seasFt).toBe(8);
    expect(p.swellDirAbbr).toBe('NW');
    expect(p.swellHtFt).toBe(8);
    expect(p.swellPeriodSec).toBe(9);
  });

  it('parses calm forecast without gust', () => {
    const text = 'NW wind 5 to 10 kt. Seas 4 ft. Wave Detail: NW 4 ft at 12 seconds.';
    const p = parseMarineProse(text);
    expect(p.windLowKt).toBe(5);
    expect(p.windHighKt).toBe(10);
    expect(p.gustKt).toBeUndefined();
    expect(p.seasFt).toBe(4);
    expect(p.swellPeriodSec).toBe(12);
  });

  it('handles "Seas around N ft" form', () => {
    const p = parseMarineProse(
      'NW wind 8 to 12 kt. Seas around 5 ft. Wave Detail: NW 5 ft at 11 seconds.'
    );
    expect(p.seasFt).toBe(5);
  });

  it('returns empty object when no patterns match', () => {
    const p = parseMarineProse('Patchy fog. Visibility 1 nm or less at times.');
    expect(p.windHighKt).toBeUndefined();
    expect(p.seasFt).toBeUndefined();
  });

  it('handles compound wind direction (WNW)', () => {
    const p = parseMarineProse('WNW wind 10 to 15 kt. Seas 5 ft.');
    expect(p.windDirAbbr).toBe('WNW');
    expect(p.windDirDeg).toBe(292.5);
  });

  it('handles "Seas N to M ft" range (uses high end for safety)', () => {
    const p = parseMarineProse('NW wind 10 to 15 kt. Seas 4 to 6 ft.');
    expect(p.seasFt).toBe(6);
  });

  it('handles "Seas N ft or less"', () => {
    const p = parseMarineProse('NW wind 5 to 10 kt. Seas 3 ft or less.');
    expect(p.seasFt).toBe(3);
  });

  it('handles "Winds becoming <DIR> N to M kt" transition phrasing', () => {
    const p = parseMarineProse('Winds becoming N 15 to 20 kt this afternoon. Seas 5 ft.');
    expect(p.windDirAbbr).toBe('N');
    expect(p.windLowKt).toBe(15);
    expect(p.windHighKt).toBe(20);
  });

  it('handles "with gusts to N kt" (no "up to")', () => {
    const p = parseMarineProse('N wind 15 to 20 kt with gusts to 30 kt. Seas 5 ft.');
    expect(p.gustKt).toBe(30);
  });

  it('handles "Seas N to M ft, building to P ft" (takes highest sea)', () => {
    const p = parseMarineProse('N wind 15 to 20 kt. Seas 5 to 7 ft, building to 10 ft tonight.');
    expect(p.seasFt).toBe(10);
  });
});

describe('deriveDateForPeriod', () => {
  it('assigns issuance day daytime to index 0', () => {
    const r = deriveDateForPeriod(0, '2026-05-17T16:03:00Z'); // 9:03 AM PDT
    expect(r.date).toBe('2026-05-17');
    expect(r.isDaytime).toBe(true);
  });
  it('assigns issuance day night to index 1', () => {
    const r = deriveDateForPeriod(1, '2026-05-17T16:03:00Z');
    expect(r.date).toBe('2026-05-17');
    expect(r.isDaytime).toBe(false);
  });
  it('assigns issuance day + 1 daytime to index 2', () => {
    const r = deriveDateForPeriod(2, '2026-05-17T16:03:00Z');
    expect(r.date).toBe('2026-05-18');
    expect(r.isDaytime).toBe(true);
  });
  it('index 8 -> issuance day + 4 daytime', () => {
    const r = deriveDateForPeriod(8, '2026-05-17T16:03:00Z');
    expect(r.date).toBe('2026-05-21');
    expect(r.isDaytime).toBe(true);
  });
});
