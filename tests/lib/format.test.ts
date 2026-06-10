import { describe, it, expect } from 'vitest';
import { toPacificLocalISO, ptLocalIsoToEpochMs } from '../../src/lib/format.js';

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

describe('ptLocalIsoToEpochMs', () => {
  it('converts a PDT local time (June, UTC-7)', () => {
    expect(ptLocalIsoToEpochMs('2026-06-10T14:00')).toBe(Date.parse('2026-06-10T21:00:00Z'));
  });

  it('converts a PST local time (January, UTC-8)', () => {
    expect(ptLocalIsoToEpochMs('2026-01-15T14:00')).toBe(Date.parse('2026-01-15T22:00:00Z'));
  });

  it('round-trips with toPacificLocalISO', () => {
    const ms = ptLocalIsoToEpochMs('2026-06-10T05:43');
    expect(toPacificLocalISO(new Date(ms))).toBe('2026-06-10T05:43');
  });
});
