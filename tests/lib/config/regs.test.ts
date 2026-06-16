import { describe, it, expect } from 'vitest';
import { isSpeciesOpen, regs } from '../../../src/lib/config/regs.js';
import type { Species } from '../../../src/lib/types.js';

describe('regulations', () => {
  it('rockfish open 2026-05-18 (Apr 1 – Dec 31 Northern Mgmt)', () => {
    expect(isSpeciesOpen('rockfish', '2026-05-18')).toEqual({ open: true });
  });
  it('rockfish closed 2026-01-15 (before Apr 1)', () => {
    const r = isSpeciesOpen('rockfish', '2026-01-15');
    expect(r.open).toBe(false);
  });
  it('lingcod tracks rockfish in Northern Mgmt Area', () => {
    expect(isSpeciesOpen('lingcod', '2026-05-18').open).toBe(true);
  });
  it('salmon open 2026-06-20 (within Jun 13 – Jul 19 window)', () => {
    expect(isSpeciesOpen('salmon', '2026-06-20').open).toBe(true);
  });
  it('salmon closed 2026-07-25 (between Jul 19 and Aug 1)', () => {
    expect(isSpeciesOpen('salmon', '2026-07-25').open).toBe(false);
  });
  it('salmon open 2026-08-15 (within Aug 1 – Aug 31 window)', () => {
    expect(isSpeciesOpen('salmon', '2026-08-15').open).toBe(true);
  });
  it('salmon regs reference the hotline', () => {
    expect(regs.salmon.hotlinePhone).toBe('707-576-3429');
    expect(regs.salmon.requiresHotlineVerify).toBe(true);
  });
  it('surfperch open 2026-07-04 (year-round window)', () => {
    expect(isSpeciesOpen('surfperch', '2026-07-04').open).toBe(true);
  });
  it('cutthroat closed 2026-12-01 (within Stone Lagoon spawning closure)', () => {
    expect(isSpeciesOpen('cutthroat', '2026-12-01').open).toBe(false);
  });
  it('cutthroat open 2026-05-18 (within Mar 1 – Nov 20 window)', () => {
    expect(isSpeciesOpen('cutthroat', '2026-05-18').open).toBe(true);
  });

  it('california-halibut open 2026-05-18 (year-round)', () => {
    expect(isSpeciesOpen('california-halibut', '2026-05-18').open).toBe(true);
  });

  it('dungeness-crab open 2026-05-18 (within Jan-Jul window)', () => {
    expect(isSpeciesOpen('dungeness-crab', '2026-05-18').open).toBe(true);
  });
  it('dungeness-crab closed 2026-08-15 (off-season)', () => {
    expect(isSpeciesOpen('dungeness-crab', '2026-08-15').open).toBe(false);
  });
  it('dungeness-crab open 2026-11-15 (new season opens Nov 1)', () => {
    expect(isSpeciesOpen('dungeness-crab', '2026-11-15').open).toBe(true);
  });

  it('pacific-halibut open 2026-06-15 (within May 1 – Nov 15 window)', () => {
    expect(isSpeciesOpen('pacific-halibut', '2026-06-15').open).toBe(true);
  });
  it('pacific-halibut closed 2026-12-15 (after Nov 15)', () => {
    expect(isSpeciesOpen('pacific-halibut', '2026-12-15').open).toBe(false);
  });
  it('pacific-halibut requires verify-before-launch flag', () => {
    expect(regs['pacific-halibut'].requiresHotlineVerify).toBe(true);
  });

  it('albacore-tuna open 2026-02-01 (year-round legal)', () => {
    expect(isSpeciesOpen('albacore-tuna', '2026-02-01').open).toBe(true);
  });

  it('bluegill open 2026-05-18 (year-round inland)', () => {
    expect(isSpeciesOpen('bluegill', '2026-05-18').open).toBe(true);
  });
  it('largemouth-bass open 2026-12-15 (year-round inland)', () => {
    expect(isSpeciesOpen('largemouth-bass', '2026-12-15').open).toBe(true);
  });
});

// ── retargeted from the old .requirements assertions ──
describe('catch rules content (migrated from requirements[])', () => {
  it('rockfish keeps the descender-device rule', () => {
    expect(regs.rockfish.rules.otherRules?.some((r) => r.toLowerCase().includes('descender'))).toBe(true);
  });
  it('rockfish has the vermilion+sunset sub-limit and no-retention list', () => {
    expect(regs.rockfish.rules.subLimits?.value.some((s) => /vermilion/i.test(s.species))).toBe(true);
    expect(regs.rockfish.rules.prohibited?.some((p) => /yelloweye/i.test(p))).toBe(true);
  });
  it('surfperch daily bag is 20', () => {
    expect(regs.surfperch.rules.bag.value.daily).toBe(20);
  });
  it('cutthroat gear includes a barbless restriction (historical)', () => {
    expect(regs.cutthroat.rules.gear?.value.some((g) => g.toLowerCase().includes('barbless'))).toBe(true);
    expect(regs.cutthroat.rules.gear?.confidence).toBe('historical');
  });
  it('california halibut minimum size is 22 inches', () => {
    expect(regs['california-halibut'].rules.size.value.minInches).toBe(22);
  });
  it('dungeness crab keeps the domoic-acid advisory', () => {
    expect(regs['dungeness-crab'].rules.otherRules?.some((r) => r.toLowerCase().includes('domoic'))).toBe(true);
  });
  it('pacific halibut lists the Pacific Halibut Card under license', () => {
    expect(regs['pacific-halibut'].rules.license.some((r) => r.toLowerCase().includes('halibut card'))).toBe(true);
  });
  it('albacore has no bag limit and it is flagged unverified', () => {
    expect(regs['albacore-tuna'].rules.bag.value.none).toBe(true);
    expect(regs['albacore-tuna'].rules.bag.confidence).toBe('unverified');
  });
  it('largemouth bass minimum size is 12 inches', () => {
    expect(regs['largemouth-bass'].rules.size.value.minInches).toBe(12);
  });
  it('rainbow trout keeps the planting-schedule note', () => {
    expect(regs['rainbow-trout'].rules.otherRules?.some((r) => r.toLowerCase().includes('planting'))).toBe(true);
  });
});

// ── new structural guarantees ──
describe('catch rules shape', () => {
  const allSpecies = Object.keys(regs) as Species[];
  const confidences = ['confirmed', 'historical', 'unverified'];

  it('every species has rules + meta with a valid source URL', () => {
    for (const s of allSpecies) {
      expect(regs[s].rules, s).toBeDefined();
      expect(regs[s].rules.size, s).toBeDefined();
      expect(regs[s].rules.bag, s).toBeDefined();
      expect(regs[s].rules.license.length, s).toBeGreaterThan(0);
      expect(() => new URL(regs[s].meta.sourceUrl), s).not.toThrow();
      expect(regs[s].meta.lastUpdated.length, s).toBeGreaterThan(0);
    }
  });

  it('every RegValue carries a valid confidence', () => {
    for (const s of allSpecies) {
      const r = regs[s].rules;
      expect(confidences, s).toContain(r.size.confidence);
      expect(confidences, s).toContain(r.bag.confidence);
      if (r.gear) expect(confidences, s).toContain(r.gear.confidence);
      if (r.subLimits) expect(confidences, s).toContain(r.subLimits.confidence);
    }
  });

  it('no species still carries the old requirements field', () => {
    for (const s of allSpecies) {
      expect((regs[s] as unknown as Record<string, unknown>).requirements, s).toBeUndefined();
    }
  });
});
