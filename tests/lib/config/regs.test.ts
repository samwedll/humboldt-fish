import { describe, it, expect } from 'vitest';
import { isSpeciesOpen, regs } from '../../../src/lib/config/regs.js';

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
  it('rockfish requires descender device', () => {
    expect(regs.rockfish.requirements.some((r) => r.toLowerCase().includes('descender'))).toBe(true);
  });
  it('surfperch open 2026-07-04 (year-round window)', () => {
    expect(isSpeciesOpen('surfperch', '2026-07-04').open).toBe(true);
  });
  it('surfperch regs cite 20-fish daily bag', () => {
    expect(regs.surfperch.requirements.some((r) => r.toLowerCase().includes('20 fish'))).toBe(true);
  });
  it('cutthroat closed 2026-12-01 (within Stone Lagoon spawning closure)', () => {
    expect(isSpeciesOpen('cutthroat', '2026-12-01').open).toBe(false);
  });
  it('cutthroat open 2026-05-18 (within Mar 1 – Nov 20 window)', () => {
    expect(isSpeciesOpen('cutthroat', '2026-05-18').open).toBe(true);
  });
  it('cutthroat regs mention barbless hook', () => {
    expect(regs.cutthroat.requirements.some((r) => r.toLowerCase().includes('barbless'))).toBe(true);
  });

  it('california-halibut open 2026-05-18 (year-round)', () => {
    expect(isSpeciesOpen('california-halibut', '2026-05-18').open).toBe(true);
  });
  it('california-halibut regs cite 22" min size', () => {
    expect(regs['california-halibut'].requirements.some((r) => /22/.test(r))).toBe(true);
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
  it('dungeness-crab regs mention domoic-acid check', () => {
    expect(
      regs['dungeness-crab'].requirements.some((r) => r.toLowerCase().includes('domoic'))
    ).toBe(true);
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
  it('pacific-halibut requirements mention the halibut card', () => {
    expect(
      regs['pacific-halibut'].requirements.some((r) => r.toLowerCase().includes('halibut card'))
    ).toBe(true);
  });

  it('albacore-tuna open 2026-02-01 (year-round legal)', () => {
    expect(isSpeciesOpen('albacore-tuna', '2026-02-01').open).toBe(true);
  });
  it('albacore-tuna regs cite no bag limit', () => {
    expect(
      regs['albacore-tuna'].requirements.some((r) => r.toLowerCase().includes('no bag limit'))
    ).toBe(true);
  });

  it('bluegill open 2026-05-18 (year-round inland)', () => {
    expect(isSpeciesOpen('bluegill', '2026-05-18').open).toBe(true);
  });
  it('largemouth-bass open 2026-12-15 (year-round inland)', () => {
    expect(isSpeciesOpen('largemouth-bass', '2026-12-15').open).toBe(true);
  });
  it('largemouth-bass regs cite the 12-inch minimum', () => {
    expect(regs['largemouth-bass'].requirements.some((r) => /12 inches/.test(r))).toBe(true);
  });
  it('rainbow-trout regs reference the fish-planting schedule', () => {
    expect(regs['rainbow-trout'].requirements.some((r) => /planting/.test(r))).toBe(true);
  });
});
