import { describe, it, expect } from 'vitest';
import { idGuides, idGuideForLaunch } from '../../../src/lib/config/identification.js';
import { regs } from '../../../src/lib/config/regs.js';
import type { Species } from '../../../src/lib/types.js';

describe('lagoon trout identification guide', () => {
  it('resolves for each lagoon launch', () => {
    expect(idGuideForLaunch('big-lagoon')?.id).toBe('lagoon-trout');
    expect(idGuideForLaunch('stone-lagoon')?.id).toBe('lagoon-trout');
    expect(idGuideForLaunch('freshwater-lagoon')?.id).toBe('lagoon-trout');
  });
  it('does not resolve for an open-ocean launch', () => {
    expect(idGuideForLaunch('trinidad')).toBeUndefined();
  });
  it('compares cutthroat, rainbow and steelhead', () => {
    const g = idGuideForLaunch('big-lagoon')!;
    const names = g.candidates.map((c) => c.origin);
    expect(names).toEqual(expect.arrayContaining(['wild', 'stocked', 'anadromous']));
  });
  it('leads with a release-when-uncertain default', () => {
    expect(idGuideForLaunch('big-lagoon')!.whenUncertain.toLowerCase()).toContain('release');
  });
  it('every rulesSpecies resolves to a real species', () => {
    for (const g of idGuides) {
      for (const c of g.candidates) {
        if (c.rulesSpecies) expect(regs[c.rulesSpecies as Species]).toBeDefined();
      }
    }
  });
  it('the steelhead candidate names the adipose-clip tell', () => {
    const g = idGuideForLaunch('big-lagoon')!;
    const steelhead = g.candidates.find((c) => c.origin === 'anadromous')!;
    expect(steelhead.tells.value.join(' ').toLowerCase()).toContain('adipose');
  });
});
