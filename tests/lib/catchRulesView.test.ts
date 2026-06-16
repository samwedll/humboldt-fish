import { describe, it, expect } from 'vitest';
import { formatSize, formatBag, formatSubLimit } from '../../src/lib/catchRulesView.js';

describe('catchRulesView formatters', () => {
  it('formats a minimum size', () => {
    expect(formatSize({ minInches: 22, measure: 'total length' })).toBe('≥ 22″ total length');
  });
  it('formats no-size-limit', () => {
    expect(formatSize({ none: true })).toBe('No minimum size');
  });
  it('formats a daily + possession bag', () => {
    expect(formatBag({ daily: 1, possession: 1, unit: 'fish' })).toBe('1 / day · 1 possession fish');
  });
  it('formats a daily-only bag with default unit', () => {
    expect(formatBag({ daily: 10 })).toBe('10 / day fish');
  });
  it('formats no-bag-limit', () => {
    expect(formatBag({ none: true })).toBe('No bag limit');
  });
  it('formats a sub-limit', () => {
    expect(formatSubLimit({ species: 'vermilion + sunset rockfish', daily: 4, note: 'Northern Mgmt Area' }))
      .toBe('vermilion + sunset rockfish: 4 / day (Northern Mgmt Area)');
  });
});
