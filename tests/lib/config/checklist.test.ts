import { describe, it, expect } from 'vitest';
import { checklistFor } from '../../../src/lib/config/checklist.js';

const DAWN = Date.parse('2026-06-10T12:00:00Z'); // 05:00 PT (PDT)
const DUSK = Date.parse('2026-06-11T04:00:00Z'); // 21:00 PT
const NOON = Date.parse('2026-06-10T19:00:00Z'); // 12:00 PT
const HOUR = 3_600_000;

describe('checklistFor', () => {
  it('always includes the bar recorder', () => {
    const items = checklistFor({
      species: 'rockfish', launch: 'trinidad',
      launchAtMs: NOON, returnByMs: NOON + 4 * HOUR, dawnMs: DAWN, duskMs: DUSK
    });
    expect(items.some((i) => i.id === 'bar-status')).toBe(true);
    expect(items.find((i) => i.id === 'bar-status')!.phone).toBe('707-839-6113');
  });

  it('adds the salmon hotline only for salmon', () => {
    const base = { launch: 'trinidad' as const, launchAtMs: NOON, returnByMs: NOON + 4 * HOUR, dawnMs: DAWN, duskMs: DUSK };
    expect(checklistFor({ ...base, species: 'salmon' }).some((i) => i.id === 'salmon-hotline')).toBe(true);
    expect(checklistFor({ ...base, species: 'rockfish' }).some((i) => i.id === 'salmon-hotline')).toBe(false);
  });

  it('adds spit verification for ocean-facing-spit lagoons', () => {
    const items = checklistFor({
      species: 'cutthroat', launch: 'big-lagoon',
      launchAtMs: NOON, returnByMs: NOON + 4 * HOUR, dawnMs: DAWN, duskMs: DUSK
    });
    expect(items.some((i) => i.id === 'spit-status')).toBe(true);
  });

  it('adds low-light gear when launching in the twilight band after earliest launch', () => {
    const items = checklistFor({
      species: 'rockfish', launch: 'trinidad',
      launchAtMs: DAWN + 45 * 60_000, returnByMs: DAWN + 4 * HOUR, dawnMs: DAWN, duskMs: DUSK
    });
    expect(items.some((i) => i.id === 'low-light')).toBe(true);
  });

  it('low-light boundaries are inclusive on both sides', () => {
    const base = { species: 'rockfish' as const, launch: 'trinidad' as const, dawnMs: DAWN, duskMs: DUSK };
    // exactly dawn + 60 min (earliest launch + margin) → included
    expect(checklistFor({ ...base, launchAtMs: DAWN + 60 * 60_000, returnByMs: DAWN + 4 * HOUR })
      .some((i) => i.id === 'low-light')).toBe(true);
    // one minute past → excluded
    expect(checklistFor({ ...base, launchAtMs: DAWN + 61 * 60_000, returnByMs: DAWN + 4 * HOUR })
      .some((i) => i.id === 'low-light')).toBe(false);
    // return exactly at dusk − 30 min → included
    expect(checklistFor({ ...base, launchAtMs: DUSK - 4 * HOUR, returnByMs: DUSK - 30 * 60_000 })
      .some((i) => i.id === 'low-light')).toBe(true);
  });

  it('trinidad has no spit-status item', () => {
    const items = checklistFor({
      species: 'rockfish', launch: 'trinidad',
      launchAtMs: NOON, returnByMs: NOON + 4 * HOUR, dawnMs: DAWN, duskMs: DUSK
    });
    expect(items.some((i) => i.id === 'spit-status')).toBe(false);
  });

  it('adds low-light gear when returning within 30 min of civil dusk', () => {
    const items = checklistFor({
      species: 'rockfish', launch: 'trinidad',
      launchAtMs: DUSK - 3 * HOUR, returnByMs: DUSK - 10 * 60_000, dawnMs: DAWN, duskMs: DUSK
    });
    expect(items.some((i) => i.id === 'low-light')).toBe(true);
  });

  it('no low-light item for a midday trip', () => {
    const items = checklistFor({
      species: 'rockfish', launch: 'trinidad',
      launchAtMs: NOON, returnByMs: NOON + 4 * HOUR, dawnMs: DAWN, duskMs: DUSK
    });
    expect(items.some((i) => i.id === 'low-light')).toBe(false);
  });
});
