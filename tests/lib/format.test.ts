import { describe, it, expect } from 'vitest';
import { toPacificLocalISO } from '../../src/lib/format.js';

describe('toPacificLocalISO', () => {
  it('returns YYYY-MM-DDTHH:MM in Pacific time (PDT)', () => {
    // 2026-05-18 12:51 UTC === 2026-05-18 05:51 PDT
    expect(toPacificLocalISO(new Date('2026-05-18T12:51:00Z'))).toBe('2026-05-18T05:51');
  });

  it('handles PST (winter)', () => {
    // 2026-01-15 16:30 UTC === 2026-01-15 08:30 PST
    expect(toPacificLocalISO(new Date('2026-01-15T16:30:00Z'))).toBe('2026-01-15T08:30');
  });

  it('rolls to prior day when UTC date is past midnight Pacific', () => {
    // 2026-05-18 02:00 UTC === 2026-05-17 19:00 PDT
    expect(toPacificLocalISO(new Date('2026-05-18T02:00:00Z'))).toBe('2026-05-17T19:00');
  });
});
