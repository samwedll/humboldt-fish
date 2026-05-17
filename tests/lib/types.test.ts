import { describe, it, expect } from 'vitest';
import type { Verdict, Check, LayerResult } from '../../src/lib/types.js';
import { isLayerStatus, isVerdictLabel } from '../../src/lib/types.js';

describe('types', () => {
  it('Verdict shape can be constructed', () => {
    const v: Verdict = {
      date: '2026-05-18',
      verdict: 'GO',
      reason: 'all green',
      layers: {
        legal: { status: 'pass', summary: 'rockfish open' },
        safety: { status: 'pass', summary: 'thresholds met' },
        quality: { status: 'pass', summary: 'good window' },
        logistics: { status: 'pass', summary: 'Trinidad ramp' }
      },
      checks: [],
      recommendations: {}
    };
    expect(v.verdict).toBe('GO');
  });

  it('LayerResult status guard works', () => {
    expect(isLayerStatus('pass')).toBe(true);
    expect(isLayerStatus('warn')).toBe(true);
    expect(isLayerStatus('fail')).toBe(true);
    expect(isLayerStatus('incomplete')).toBe(true);
    expect(isLayerStatus('???')).toBe(false);
  });

  it('Verdict label guard works', () => {
    expect(isVerdictLabel('GO')).toBe(true);
    expect(isVerdictLabel('CONDITIONAL')).toBe(true);
    expect(isVerdictLabel('NO-GO')).toBe(true);
    expect(isVerdictLabel('INCOMPLETE')).toBe(true);
    expect(isVerdictLabel('MAYBE')).toBe(false);
  });
});
