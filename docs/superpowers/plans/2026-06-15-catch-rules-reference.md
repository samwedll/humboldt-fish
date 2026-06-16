# Catch-Rules Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing-but-dead per-species catch regulations as a structured, confidence-flagged, offline-capable reference shown both inside the verdict (pre-trip) and on a standalone `/rules` route (post-catch), with stock-vs-wild identification help for the lagoon trout.

**Architecture:** Replace `SpeciesRegs.requirements: string[]` with a typed `CatchRules` model carrying per-field confidence; render it through one `<CatchRulesCard>` component in two density modes (compact inside `DayCard`, full on a prerendered `/rules` route); make the whole reference work offline via an installable PWA (`@vite-pwa/sveltekit`); add a launch-keyed `IdGuide` for the lagoon trout. Catch rules are **display-only** — the verdict logic is unchanged.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), TypeScript, Vitest 4 (jsdom + `@testing-library/svelte`), Tailwind 3, `@sveltejs/adapter-cloudflare`, `@vite-pwa/sveltekit`.

**Spec:** `docs/superpowers/specs/2026-06-15-catch-rules-reference-design.md`
**Branch:** `feat/catch-rules-reference` (already created; the spec commit is its first commit).

---

## File structure

**New files**
- `src/lib/config/identification.ts` — `IdGuide`/`IdCandidate` types, `idGuides`, `idGuideForLaunch()`.
- `reference/regs/lagoon-trout-id-2026.md` — canonical ID content (mirror of the above).
- `src/lib/catchRulesView.ts` — pure formatters (`formatSize`/`formatBag`/`formatSubLimit`).
- `src/lib/rulesParams.ts` — pure `parseRulesParams()` for the `/rules` deep-link.
- `src/lib/components/VerifyBadge.svelte` — confidence chip → source URL.
- `src/lib/components/RegRow.svelte` — one labelled rule line.
- `src/lib/components/CatchRulesCard.svelte` — the shared card (`mode: 'compact' | 'full'`).
- `src/routes/rules/+page.ts` — `prerender = true`.
- `src/routes/rules/+page.svelte` — full reference view.
- `tests/setup.ts` — registers `@testing-library/jest-dom` matchers.
- `tests/lib/catchRulesView.test.ts`, `tests/lib/rulesParams.test.ts`, `tests/lib/config/identification.test.ts`, `tests/lib/components/VerifyBadge.test.ts`, `tests/lib/components/RegRow.test.ts`, `tests/lib/components/CatchRulesCard.test.ts`.
- PWA icon assets under `static/` (generated).

**Modified files**
- `src/lib/config/regs.ts` — new types + `SpeciesRegs` reshape + 12 species migrated off `requirements[]`.
- `tests/lib/config/regs.test.ts` — `.requirements` assertions retargeted to `rules`/`meta` + new structural assertions.
- `src/lib/components/DayCard.svelte` — new `launch` prop; embed compact `CatchRulesCard`.
- `src/routes/+page.svelte` — pass `launch` to `DayCard`; header "Rules" link.
- `vite.config.ts` — add `SvelteKitPWA`.
- `vitest.config.ts` — add `setupFiles`.
- `src/app.html` — theme-color + apple-touch-icon.
- `package.json` — add PWA dev deps.
- `CLAUDE.md` — retire the Claude.ai round-trip; register `/rules` + PWA.

---

# Phase 1 — Data model & migration

### Task 1: Failing tests for the new reg shape

**Files:**
- Test: `tests/lib/config/regs.test.ts` (modify — this file currently asserts against `.requirements`)

- [ ] **Step 1: Replace the `.requirements`-based assertions and add structural assertions.** Open `tests/lib/config/regs.test.ts`. Keep the existing `isSpeciesOpen` season tests as-is. Replace every assertion that reads `.requirements` with the structured equivalent below, and append the new `describe('catch rules shape', …)` block.

```typescript
import { describe, it, expect } from 'vitest';
import { isSpeciesOpen, regs } from '../../../src/lib/config/regs.js';
import type { Species } from '../../../src/lib/types.js';

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
      expect((regs[s] as Record<string, unknown>).requirements, s).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the tests; confirm they fail.**

Run: `pnpm test -- tests/lib/config/regs.test.ts`
Expected: FAIL — TypeScript/runtime errors like "Property 'rules' does not exist on type 'SpeciesRegs'" (the season tests still pass; the new ones error).

- [ ] **Step 3: Commit the failing tests.**

```bash
git add tests/lib/config/regs.test.ts
git commit -m "test: assert structured catch-rules shape (red)"
```

---

### Task 2: Implement the typed model and migrate all 12 species

**Files:**
- Modify: `src/lib/config/regs.ts` (replace the `SpeciesRegs` interface + the entire `regs` object; keep `isSpeciesOpen` and `SeasonCheck` unchanged)

- [ ] **Step 1: Replace the type definitions and `regs` object.** In `src/lib/config/regs.ts`, keep the top file comment, the `import type { Species, LaunchId }` line, and everything from `export interface SeasonCheck` downward (`isSpeciesOpen`). Replace the `SpeciesRegs` interface and the `regs` constant with the following. (Confidence rule used below: a value is `'historical'` when the source string says "historically", `'unverified'` when it says "verify current"/"verify 2026", else `'confirmed'`.)

```typescript
export type Confidence = 'confirmed' | 'historical' | 'unverified';

/** A regulatory value that may be confirmed-for-2026 or merely last-known. */
export interface RegValue<T> {
  value: T;
  confidence: Confidence;
  note?: string;
}

export interface SizeLimit { minInches?: number; measure?: string; none?: boolean; }
export interface BagLimit { daily?: number; possession?: number; unit?: string; none?: boolean; }
export interface SubLimit { species: string; daily: number; note?: string; }

export interface CatchRules {
  size: RegValue<SizeLimit>;
  bag: RegValue<BagLimit>;
  subLimits?: RegValue<SubLimit[]>;
  prohibited?: string[];          // zero-retention species / release-only rules
  gear?: RegValue<string[]>;
  license: string[];
  otherRules?: string[];          // catch-all w/o a typed home
}

/** Verification metadata, lifted from the species' reference/regs/*.md header. */
export interface RegMeta { lastUpdated: string; draft: boolean; sourceUrl: string; }

export interface SpeciesRegs {
  label: string;
  seasonWindows: Array<{ start: string; end: string }>;
  perLaunchSeasonWindows?: Partial<Record<LaunchId, Array<{ start: string; end: string }>>>;
  rules: CatchRules;
  meta: RegMeta;
  hotlinePhone?: string;
  hotlineLabel?: string;
  requiresHotlineVerify: boolean;
}

export const regs: Record<Species, SpeciesRegs> = {
  rockfish: {
    label: 'Rockfish (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { daily: 10, unit: 'fish' }, confidence: 'confirmed',
             note: 'RCG aggregate (rockfish/cabezon/greenling complex)' },
      subLimits: { value: [{ species: 'vermilion + sunset rockfish', daily: 4, note: 'Northern Mgmt Area' }],
                   confidence: 'confirmed' },
      prohibited: ['bronzespotted rockfish', 'cowcod', 'quillback rockfish', 'yelloweye rockfish'],
      license: ['CDFW Sport Fishing License'],
      otherRules: ['Descender device required on board (CCR T-14 §27.20(b)(2))']
    },
    meta: { lastUpdated: 'May 2, 2026', draft: false,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Groundfish-Summary' },
    requiresHotlineVerify: false
  },
  lingcod: {
    label: 'Lingcod (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    rules: {
      size: { value: { minInches: 22, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 2, unit: 'fish' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License'],
      otherRules: [
        'Descender device required on board (combined groundfish trips)',
        'Fillets: minimum 14" with entire skin attached'
      ]
    },
    meta: { lastUpdated: 'May 2, 2026', draft: false,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Groundfish-Summary' },
    requiresHotlineVerify: false
  },
  salmon: {
    label: 'Salmon (KMZ — Klamath Management Zone)',
    seasonWindows: [
      { start: '2026-06-13', end: '2026-07-19' },
      { start: '2026-08-01', end: '2026-08-31' }
    ],
    rules: {
      size: { value: { minInches: 20, measure: 'total length' }, confidence: 'confirmed', note: 'Chinook' },
      bag: { value: { daily: 2, unit: 'Chinook' }, confidence: 'confirmed' },
      prohibited: ['Coho (silver) salmon — prohibited, must release'],
      gear: { value: [
        'Max 2 single-point, single-shank, barbless hooks',
        'One rod per angler when targeting salmon or with salmon aboard'
      ], confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (no salmon report card required for ocean salmon)']
    },
    meta: { lastUpdated: 'May 2, 2026', draft: false,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Salmon' },
    hotlinePhone: '707-576-3429',
    hotlineLabel: 'CDFW Ocean Salmon Hotline',
    requiresHotlineVerify: true
  },
  surfperch: {
    label: 'Surfperch (Northern District)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { daily: 20, unit: 'fish' }, confidence: 'confirmed', note: 'total across the surfperch family' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Redtail surfperch sub-limit applies — verify current with CDFW']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Surf-Fishing' },
    requiresHotlineVerify: false
  },
  cutthroat: {
    label: 'Coastal Cutthroat Trout (Humboldt Lagoons)',
    seasonWindows: [{ start: '2026-03-01', end: '2026-11-20' }],
    perLaunchSeasonWindows: {
      'big-lagoon': [{ start: '2026-01-01', end: '2026-12-31' }]
    },
    rules: {
      size: { value: { minInches: 14, measure: 'total length' }, confidence: 'historical',
              note: 'Big Lagoon historically — verify 2026 with CDFW' },
      bag: { value: { daily: 1, possession: 1, unit: 'fish' }, confidence: 'historical',
             note: 'both lagoons historically' },
      gear: { value: ['Artificial-lure only', 'Single-point barbless hook (no bait, no treble)'],
              confidence: 'historical', note: 'historically — verify 2026' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Catch-and-release encouraged; coastal cutthroat is a species of conservation concern']
    },
    meta: { lastUpdated: '2026-05-17', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' },
    requiresHotlineVerify: false
  },
  'california-halibut': {
    label: 'California Halibut (Northern District)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { minInches: 22, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 3, unit: 'fish' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (16+)']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Saltwater-General' },
    requiresHotlineVerify: false
  },
  'dungeness-crab': {
    label: 'Dungeness Crab (Sport)',
    seasonWindows: [
      { start: '2026-01-01', end: '2026-07-30' },
      { start: '2026-11-01', end: '2026-12-31' }
    ],
    rules: {
      size: { value: { minInches: 5.75, measure: 'carapace width across the back' }, confidence: 'confirmed' },
      bag: { value: { daily: 10, unit: 'crabs' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Check CDPH for domoic-acid closures before every trip']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Crab' },
    requiresHotlineVerify: false
  },
  'pacific-halibut': {
    label: 'Pacific Halibut',
    seasonWindows: [{ start: '2026-05-01', end: '2026-11-15' }],
    rules: {
      size: { value: { minInches: 22, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 1, unit: 'fish' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (16+)',
                'Pacific Halibut Card (free, online from CDFW) — must record each kept fish'],
      otherRules: ['Season can close inseason without warning — verify before each trip']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Pacific-Halibut' },
    hotlinePhone: undefined,
    hotlineLabel: 'CDFW Pacific Halibut page + IPHC inseason actions',
    requiresHotlineVerify: true
  },
  'albacore-tuna': {
    label: 'Albacore Tuna',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { none: true }, confidence: 'unverified', note: 'no bag limit — verify current' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Real-world viability is June–October when 60°F+ water pushes inshore']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Tuna' },
    requiresHotlineVerify: false
  },
  bluegill: {
    label: 'Bluegill (CA Inland)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { none: true }, confidence: 'confirmed', note: 'no bag limit in most CA inland waters' },
      license: ['CDFW Sport Fishing License (16+)']
    },
    meta: { lastUpdated: '2026-05-17', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' },
    requiresHotlineVerify: false
  },
  'largemouth-bass': {
    label: 'Largemouth Bass',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { minInches: 12, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 5, unit: 'fish' }, confidence: 'confirmed',
             note: 'largemouth/smallmouth/spotted combined (black bass)' },
      license: ['CDFW Sport Fishing License (16+)']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland/Black-Bass' },
    requiresHotlineVerify: false
  },
  'rainbow-trout': {
    label: 'Rainbow Trout (stocker / inland)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed', note: 'no statewide inland size limit' },
      bag: { value: { daily: 5, unit: 'trout' }, confidence: 'confirmed', note: 'statewide inland' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Check CDFW fish-planting schedule before each trip — fishing is best 1-2 days after a plant']
    },
    meta: { lastUpdated: '2026-05-17', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' },
    requiresHotlineVerify: false
  }
};
```

- [ ] **Step 2: Update the file's top comment** so it no longer mentions `requirements[]`. Change the line `Source of truth is the markdown; this is the runtime copy.` block to add: `Each species' rules + meta mirror reference/regs/<file>.md (size/bag/gear/license/other + the header's Last-updated/DRAFT/Source).`

- [ ] **Step 3: Run the regs tests.**

Run: `pnpm test -- tests/lib/config/regs.test.ts`
Expected: PASS (season tests + the retargeted + structural tests).

- [ ] **Step 4: Typecheck and full suite.**

Run: `pnpm run check && pnpm test`
Expected: `check` clean; full suite green (runLegal/orchestrate untouched — they never read `requirements`).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/config/regs.ts tests/lib/config/regs.test.ts
git commit -m "feat: typed CatchRules model; migrate regs off requirements[]"
```

---

# Phase 2 — View helpers & identification

### Task 3: Pure catch-rules formatters

**Files:**
- Create: `src/lib/catchRulesView.ts`
- Test: `tests/lib/catchRulesView.test.ts`

- [ ] **Step 1: Write the failing test.**

```typescript
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
```

- [ ] **Step 2: Run it; confirm it fails.**

Run: `pnpm test -- tests/lib/catchRulesView.test.ts`
Expected: FAIL — "Failed to resolve import … catchRulesView".

- [ ] **Step 3: Implement.**

```typescript
import type { SizeLimit, BagLimit, SubLimit } from './config/regs.js';

export function formatSize(s: SizeLimit): string {
  if (s.none) return 'No minimum size';
  if (s.minInches == null) return 'See notes';
  return `≥ ${s.minInches}″${s.measure ? ` ${s.measure}` : ''}`;
}

export function formatBag(b: BagLimit): string {
  if (b.none) return 'No bag limit';
  const unit = b.unit ?? 'fish';
  const daily = b.daily != null ? `${b.daily} / day` : '';
  const poss = b.possession != null ? ` · ${b.possession} possession` : '';
  return `${daily}${poss} ${unit}`.trim();
}

export function formatSubLimit(s: SubLimit): string {
  return `${s.species}: ${s.daily} / day${s.note ? ` (${s.note})` : ''}`;
}
```

- [ ] **Step 4: Run; confirm pass.**

Run: `pnpm test -- tests/lib/catchRulesView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/catchRulesView.ts tests/lib/catchRulesView.test.ts
git commit -m "feat: pure formatters for catch-rules display"
```

---

### Task 4: Lagoon-trout identification guide

**Files:**
- Create: `reference/regs/lagoon-trout-id-2026.md`
- Create: `src/lib/config/identification.ts`
- Test: `tests/lib/config/identification.test.ts`

- [ ] **Step 1: Write the failing test.**

```typescript
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
```

- [ ] **Step 2: Run it; confirm it fails.**

Run: `pnpm test -- tests/lib/config/identification.test.ts`
Expected: FAIL — import resolution error.

- [ ] **Step 3: Create the canonical markdown** `reference/regs/lagoon-trout-id-2026.md`:

```markdown
# Lagoon Trout — Which Fish Do I Have? 2026

**Last updated:** 2026-06-15 (DRAFT — verify field marks with CDFW before relying on)
**Region:** Big Lagoon, Stone Lagoon, Freshwater Lagoon (Humboldt Lagoons State Park)
**Source for verification:** <https://wildlife.ca.gov/Fishing/Inland>

---

## Why this matters

Coastal cutthroat (wild, conservation-concern, 1 fish/day) and rainbow trout (stocked,
5/day) can both turn up in these lagoons, and they **hybridize** — so the classic field
marks are not always definitive. A sea-run rainbow (steelhead) adds a third case with
its own wild-vs-hatchery retention rules.

## When uncertain

**If you cannot positively confirm the fish, release it.** Coastal cutthroat is a species
of conservation concern and the 1-fish limit is unforgiving.

## Coastal cutthroat trout (wild) — Oncorhynchus clarkii clarkii

- Red-orange "cutthroat" slash under each side of the lower jaw
- Small black spots over most of the body, including below the lateral line and onto the tail
- Body olive to coppery; teeth often present on the back of the tongue (basibranchial)
- Rules: 1/day, barbless artificial lure, catch-and-release encouraged

## Rainbow trout (stocked) — Oncorhynchus mykiss

- Broad pink-to-red band along the lateral line; **no** jaw slash
- Spots concentrated on the upper body and tail; white-to-pink mouth
- Stocked fish may show worn/rounded fins from the hatchery
- Rules: 5/day (inland), check the planting schedule

## Steelhead (sea-run rainbow) — Oncorhynchus mykiss

- A rainbow that has been to sea: bright silver, larger, faint stripe
- **Hatchery steelhead have a clipped adipose fin** (healed scar where the small fin
  behind the dorsal should be)
- Wild steelhead have an intact adipose fin and are release-only in most coastal waters
- Rules: wild = release-only; hatchery (clipped) per CDFW steelhead regs + report card

## TODO (verify before trusting)

- [ ] Confirm 2026 field marks and any lagoon-specific cutthroat identification guidance with CDFW District 1
- [ ] Confirm current steelhead wild-vs-hatchery retention rules for these waters
```

- [ ] **Step 4: Create the typed mirror** `src/lib/config/identification.ts`:

```typescript
import type { LaunchId, Species } from '../types.js';
import type { Confidence, RegMeta } from './regs.js';

export interface IdCandidate {
  name: string;
  scientific?: string;
  origin: 'wild' | 'stocked' | 'anadromous';
  tells: { value: string[]; confidence: Confidence };
  ruleSummary: string;
  rulesSpecies?: Species;
}

export interface IdGuide {
  id: string;
  title: string;
  appliesToLaunches: LaunchId[];
  candidates: IdCandidate[];
  whenUncertain: string;
  meta: RegMeta;
}

export const idGuides: IdGuide[] = [
  {
    id: 'lagoon-trout',
    title: 'Which trout do I have?',
    appliesToLaunches: ['big-lagoon', 'stone-lagoon', 'freshwater-lagoon'],
    candidates: [
      {
        name: 'Coastal cutthroat trout',
        scientific: 'Oncorhynchus clarkii clarkii',
        origin: 'wild',
        tells: {
          value: [
            'Red-orange "cutthroat" slash under each side of the lower jaw',
            'Small black spots over most of the body, including below the lateral line and onto the tail',
            'Body olive to coppery; teeth often present on the back of the tongue'
          ],
          confidence: 'historical'
        },
        ruleSummary: '1 / day · barbless artificial lure · catch-and-release encouraged',
        rulesSpecies: 'cutthroat'
      },
      {
        name: 'Rainbow trout (stocked)',
        scientific: 'Oncorhynchus mykiss',
        origin: 'stocked',
        tells: {
          value: [
            'Broad pink-to-red band along the lateral line; no jaw slash',
            'Spots concentrated on the upper body and tail; white-to-pink mouth',
            'Stocked fish may show worn/rounded fins from the hatchery'
          ],
          confidence: 'historical'
        },
        ruleSummary: '5 / day (inland) · check the planting schedule',
        rulesSpecies: 'rainbow-trout'
      },
      {
        name: 'Steelhead (sea-run rainbow)',
        scientific: 'Oncorhynchus mykiss',
        origin: 'anadromous',
        tells: {
          value: [
            'A rainbow that has been to sea: bright silver, larger, faint stripe',
            'Hatchery steelhead have a CLIPPED adipose fin (healed scar behind the dorsal)',
            'Wild steelhead have an intact adipose fin and are release-only in most coastal waters'
          ],
          confidence: 'unverified'
        },
        ruleSummary: 'Wild = release-only; hatchery (clipped) per CDFW steelhead regs + report card',
        rulesSpecies: undefined
      }
    ],
    whenUncertain:
      'Cutthroat and rainbow hybridize in these lagoons, so the jaw slash is not always definitive. If you cannot positively confirm the fish, release it — coastal cutthroat is a species of conservation concern and the 1-fish limit is unforgiving.',
    meta: { lastUpdated: '2026-06-15', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' }
  }
];

export function idGuideForLaunch(launch: LaunchId): IdGuide | undefined {
  return idGuides.find((g) => g.appliesToLaunches.includes(launch));
}
```

- [ ] **Step 5: Verify the field marks against CDFW** (sourcing discipline — do NOT skip). Use WebFetch on `https://wildlife.ca.gov/Fishing/Inland` and the CDFW trout-identification pages it links. For each `tells` line you can confirm, leave `confidence: 'historical'` or upgrade to `'confirmed'`; for anything you cannot confirm, set that candidate's `tells.confidence` to `'unverified'` and note the gap in the markdown's TODO. Do not invent marks. Keep the steelhead candidate `'unverified'` unless CDFW retention rules are explicitly confirmed.

- [ ] **Step 6: Run; confirm pass; typecheck.**

Run: `pnpm test -- tests/lib/config/identification.test.ts && pnpm run check`
Expected: PASS; check clean.

- [ ] **Step 7: Commit.**

```bash
git add reference/regs/lagoon-trout-id-2026.md src/lib/config/identification.ts tests/lib/config/identification.test.ts
git commit -m "feat: lagoon-trout stock-vs-wild identification guide"
```

---

### Task 5: `/rules` deep-link parser

**Files:**
- Create: `src/lib/rulesParams.ts`
- Test: `tests/lib/rulesParams.test.ts`

- [ ] **Step 1: Write the failing test.**

```typescript
import { describe, it, expect } from 'vitest';
import { parseRulesParams } from '../../src/lib/rulesParams.js';

describe('parseRulesParams', () => {
  it('reads a valid species + launch', () => {
    expect(parseRulesParams('?species=cutthroat&launch=big-lagoon'))
      .toEqual({ launch: 'big-lagoon', species: 'cutthroat' });
  });
  it('falls back to trinidad for an unknown launch', () => {
    expect(parseRulesParams('?launch=narnia').launch).toBe('trinidad');
  });
  it('falls back to the first compatible species when species is incompatible with launch', () => {
    // salmon is not compatible with big-lagoon → first valid species there is cutthroat
    expect(parseRulesParams('?species=salmon&launch=big-lagoon').species).toBe('cutthroat');
  });
  it('defaults both when empty', () => {
    const r = parseRulesParams('');
    expect(r.launch).toBe('trinidad');
    expect(r.species).toBe('rockfish');
  });
});
```

- [ ] **Step 2: Run it; confirm it fails.**

Run: `pnpm test -- tests/lib/rulesParams.test.ts`
Expected: FAIL — import resolution error.

- [ ] **Step 3: Implement.**

```typescript
import type { Species, LaunchId } from './types.js';
import { speciesLaunchCompat } from './config/species-launch.js';
import { launches } from './config/launches.js';

export function parseRulesParams(search: string): { launch: LaunchId; species: Species } {
  const q = new URLSearchParams(search);
  const launchParam = q.get('launch');
  const launch: LaunchId = launchParam && launchParam in launches ? (launchParam as LaunchId) : 'trinidad';
  const valid = speciesLaunchCompat[launch];
  const speciesParam = q.get('species') as Species | null;
  const species: Species = speciesParam && valid.includes(speciesParam) ? speciesParam : valid[0];
  return { launch, species };
}
```

- [ ] **Step 4: Run; confirm pass.**

Run: `pnpm test -- tests/lib/rulesParams.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/rulesParams.ts tests/lib/rulesParams.test.ts
git commit -m "feat: /rules deep-link param parser"
```

---

# Phase 3 — Components

### Task 6: jest-dom setup + VerifyBadge

**Files:**
- Create: `tests/setup.ts`
- Modify: `vitest.config.ts`
- Create: `src/lib/components/VerifyBadge.svelte`
- Test: `tests/lib/components/VerifyBadge.test.ts`

- [ ] **Step 1: Register jest-dom matchers.** Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Modify `vitest.config.ts` to add `setupFiles` (keep everything else):

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: false
  }
});
```

- [ ] **Step 2: Write the failing component test.**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import VerifyBadge from '../../../src/lib/components/VerifyBadge.svelte';

describe('VerifyBadge', () => {
  it('renders nothing when confidence is confirmed', () => {
    const { container } = render(VerifyBadge, { confidence: 'confirmed', sourceUrl: 'https://example.com' });
    expect(container.querySelector('a')).toBeNull();
  });
  it('renders a verify link for historical values', () => {
    render(VerifyBadge, { confidence: 'historical', sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://wildlife.ca.gov/Fishing/Inland');
    expect(link.textContent?.toLowerCase()).toContain('verify');
  });
  it('renders a verify link for unverified values', () => {
    render(VerifyBadge, { confidence: 'unverified', sourceUrl: 'https://example.com' });
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it; confirm it fails.**

Run: `pnpm test -- tests/lib/components/VerifyBadge.test.ts`
Expected: FAIL — cannot resolve `VerifyBadge.svelte`.

- [ ] **Step 4: Implement** `src/lib/components/VerifyBadge.svelte`:

```svelte
<script lang="ts">
  import type { Confidence } from '$lib/config/regs.js';
  type Props = { confidence: Confidence; sourceUrl: string };
  let { confidence, sourceUrl }: Props = $props();
</script>

{#if confidence !== 'confirmed'}
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-800"
  >
    ⚠ Verify{confidence === 'historical' ? ' (historical)' : ''} ↗
  </a>
{/if}
```

- [ ] **Step 5: Run; confirm pass.**

Run: `pnpm test -- tests/lib/components/VerifyBadge.test.ts`
Expected: PASS (all three).

- [ ] **Step 6: Commit.**

```bash
git add tests/setup.ts vitest.config.ts src/lib/components/VerifyBadge.svelte tests/lib/components/VerifyBadge.test.ts
git commit -m "feat: VerifyBadge confidence chip + jest-dom test setup"
```

---

### Task 7: RegRow

**Files:**
- Create: `src/lib/components/RegRow.svelte`
- Test: `tests/lib/components/RegRow.test.ts`

- [ ] **Step 1: Write the failing test.**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RegRow from '../../../src/lib/components/RegRow.svelte';

describe('RegRow', () => {
  it('renders label and value', () => {
    render(RegRow, { label: 'SIZE', value: '≥ 22″ total length' });
    expect(screen.getByText('SIZE')).toBeInTheDocument();
    expect(screen.getByText(/22″ total length/)).toBeInTheDocument();
  });
  it('renders a verify badge when confidence is non-confirmed', () => {
    render(RegRow, { label: 'SIZE', value: '≥ 14″', confidence: 'historical', sourceUrl: 'https://example.com' });
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com');
  });
  it('omits the badge when confirmed', () => {
    const { container } = render(RegRow, { label: 'BAG', value: '3 / day', confidence: 'confirmed', sourceUrl: 'https://example.com' });
    expect(container.querySelector('a')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it; confirm it fails.**

Run: `pnpm test -- tests/lib/components/RegRow.test.ts`
Expected: FAIL — cannot resolve `RegRow.svelte`.

- [ ] **Step 3: Implement** `src/lib/components/RegRow.svelte`:

```svelte
<script lang="ts">
  import type { Confidence } from '$lib/config/regs.js';
  import VerifyBadge from './VerifyBadge.svelte';
  type Props = {
    label: string;
    value: string;
    confidence?: Confidence;
    sourceUrl?: string;
    note?: string;
  };
  let { label, value, confidence, sourceUrl, note }: Props = $props();
</script>

<div class="flex items-baseline justify-between gap-3 py-1">
  <span class="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
  <span class="text-right text-sm text-neutral-900">
    {value}
    {#if note}<span class="text-neutral-500"> · {note}</span>{/if}
    {#if confidence && sourceUrl}
      <VerifyBadge {confidence} {sourceUrl} />
    {/if}
  </span>
</div>
```

- [ ] **Step 4: Run; confirm pass.**

Run: `pnpm test -- tests/lib/components/RegRow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/components/RegRow.svelte tests/lib/components/RegRow.test.ts
git commit -m "feat: RegRow labelled rule line"
```

---

### Task 8: CatchRulesCard (compact + full)

**Files:**
- Create: `src/lib/components/CatchRulesCard.svelte`
- Test: `tests/lib/components/CatchRulesCard.test.ts`

- [ ] **Step 1: Write the failing test.**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CatchRulesCard from '../../../src/lib/components/CatchRulesCard.svelte';
import { regs } from '../../../src/lib/config/regs.js';
import { idGuideForLaunch } from '../../../src/lib/config/identification.js';

const cutthroat = regs.cutthroat;

describe('CatchRulesCard', () => {
  it('compact mode shows the species and a full-rules link', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta,
      mode: 'compact', rulesHref: '/rules?species=cutthroat&launch=big-lagoon'
    });
    expect(screen.getByText(/what can i keep/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /full rules/i });
    expect(link).toHaveAttribute('href', '/rules?species=cutthroat&launch=big-lagoon');
  });

  it('full mode renders the size and bag rows', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta, mode: 'full'
    });
    expect(screen.getByText('SIZE')).toBeInTheDocument();
    expect(screen.getByText('KEEP')).toBeInTheDocument();
    expect(screen.getByText(/14″/)).toBeInTheDocument();
  });

  it('full mode surfaces the verify badge for historical cutthroat values', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta, mode: 'full'
    });
    expect(screen.getAllByRole('link').some((a) => /verify/i.test(a.textContent ?? ''))).toBe(true);
  });

  it('full mode renders the ID guide block when one is passed', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta, mode: 'full',
      idGuide: idGuideForLaunch('big-lagoon')
    });
    expect(screen.getByText(/which trout do i have/i)).toBeInTheDocument();
    expect(screen.getByText(/release it/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it; confirm it fails.**

Run: `pnpm test -- tests/lib/components/CatchRulesCard.test.ts`
Expected: FAIL — cannot resolve `CatchRulesCard.svelte`.

- [ ] **Step 3: Implement** `src/lib/components/CatchRulesCard.svelte`:

```svelte
<script lang="ts">
  import type { CatchRules, RegMeta } from '$lib/config/regs.js';
  import type { IdGuide } from '$lib/config/identification.js';
  import { formatSize, formatBag, formatSubLimit } from '$lib/catchRulesView.js';
  import RegRow from './RegRow.svelte';

  type Props = {
    label: string;
    rules: CatchRules;
    meta: RegMeta;
    mode: 'compact' | 'full';
    seasonOpen?: boolean;
    idGuide?: IdGuide;
    rulesHref?: string;
  };
  let { label, rules, meta, mode, seasonOpen, idGuide, rulesHref }: Props = $props();

  const sizeText = $derived(formatSize(rules.size.value));
  const bagText = $derived(formatBag(rules.bag.value));
  // One-line compact teaser: the two rules that matter most with a fish in hand.
  const teaser = $derived(`${label.split(' (')[0]} — ${sizeText}, ${bagText}`);
</script>

{#if mode === 'compact'}
  <details class="mt-3 rounded border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
    <summary class="cursor-pointer font-medium">What can I keep?</summary>
    <div class="mt-2">
      <RegRow label="SIZE" value={sizeText} confidence={rules.size.confidence} sourceUrl={meta.sourceUrl} note={rules.size.note} />
      <RegRow label="KEEP" value={bagText} confidence={rules.bag.confidence} sourceUrl={meta.sourceUrl} note={rules.bag.note} />
      {#if rules.prohibited && rules.prohibited.length > 0}
        <RegRow label="RELEASE" value={rules.prohibited.join('; ')} />
      {/if}
      {#if rulesHref}
        <div class="mt-1 text-right">
          <a class="underline" href={rulesHref}>Full rules ↗</a>
        </div>
      {/if}
    </div>
  </details>
{:else}
  <section class="rounded-lg border border-neutral-300 bg-white p-4">
    <div class="flex items-baseline justify-between">
      <h2 class="text-base font-semibold text-neutral-900">{label}</h2>
      {#if seasonOpen !== undefined}
        <span class={`rounded-full px-2 py-0.5 text-xs font-medium ${seasonOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          Season: {seasonOpen ? 'OPEN' : 'CLOSED'}
        </span>
      {/if}
    </div>
    <div class="mt-2 divide-y divide-neutral-100">
      <RegRow label="SIZE" value={sizeText} confidence={rules.size.confidence} sourceUrl={meta.sourceUrl} note={rules.size.note} />
      <RegRow label="KEEP" value={bagText} confidence={rules.bag.confidence} sourceUrl={meta.sourceUrl} note={rules.bag.note} />
      {#if rules.subLimits}
        {#each rules.subLimits.value as s}
          <RegRow label="SUB-LIMIT" value={formatSubLimit(s)} confidence={rules.subLimits.confidence} sourceUrl={meta.sourceUrl} />
        {/each}
      {/if}
      {#if rules.prohibited && rules.prohibited.length > 0}
        <RegRow label="RELEASE" value={rules.prohibited.join('; ')} />
      {/if}
      {#if rules.gear}
        <RegRow label="GEAR" value={rules.gear.value.join('; ')} confidence={rules.gear.confidence} sourceUrl={meta.sourceUrl} note={rules.gear.note} />
      {/if}
      <RegRow label="LICENSE" value={rules.license.join('; ')} />
      {#if rules.otherRules}
        {#each rules.otherRules as o}
          <RegRow label="ALSO" value={o} />
        {/each}
      {/if}
    </div>

    {#if idGuide}
      <div class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
        <h3 class="text-sm font-semibold text-amber-900">⚠ {idGuide.title}</h3>
        <p class="mt-1 text-xs text-amber-900">{idGuide.whenUncertain}</p>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          {#each idGuide.candidates as c}
            <div class="rounded border border-amber-200 bg-white p-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-neutral-900">{c.name}</span>
                <span class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">{c.origin}</span>
              </div>
              <ul class="ml-3 mt-1 list-disc text-[11px] text-neutral-700">
                {#each c.tells.value as t}<li>{t}</li>{/each}
              </ul>
              <p class="mt-1 text-[11px] font-medium text-neutral-800">{c.ruleSummary}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <p class="mt-3 text-[11px] text-neutral-500">
      {meta.draft ? 'Draft' : 'Current'} · updated {meta.lastUpdated} ·
      <a class="underline" href={meta.sourceUrl} target="_blank" rel="noopener noreferrer">verify at CDFW ↗</a>
    </p>
  </section>
{/if}
```

- [ ] **Step 4: Run; confirm pass.**

Run: `pnpm test -- tests/lib/components/CatchRulesCard.test.ts`
Expected: PASS (all four).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/components/CatchRulesCard.svelte tests/lib/components/CatchRulesCard.test.ts
git commit -m "feat: CatchRulesCard shared compact/full reference card"
```

---

# Phase 4 — `/rules` route

### Task 9: Prerendered `/rules` view

**Files:**
- Create: `src/routes/rules/+page.ts`
- Create: `src/routes/rules/+page.svelte`

- [ ] **Step 1: Add the prerender flag.** Create `src/routes/rules/+page.ts`:

```typescript
// Static reference: rules come entirely from bundled config, no live data.
// Prerendering makes the route a static asset the service worker can precache
// for the no-signal "fish in hand" case. Params are read client-side.
export const prerender = true;
```

- [ ] **Step 2: Implement the page.** Create `src/routes/rules/+page.svelte`:

```svelte
<script lang="ts">
  import type { Species, LaunchId } from '$lib/types.js';
  import { regs, isSpeciesOpen } from '$lib/config/regs.js';
  import { speciesLaunchCompat } from '$lib/config/species-launch.js';
  import { launches } from '$lib/config/launches.js';
  import { idGuideForLaunch } from '$lib/config/identification.js';
  import { SPECIES_LABEL } from '$lib/config/species-labels.js';
  import { parseRulesParams } from '$lib/rulesParams.js';
  import CatchRulesCard from '$lib/components/CatchRulesCard.svelte';

  // Default for the prerendered HTML; real selection is read from the URL on mount.
  let launch: LaunchId = $state('trinidad');
  let species: Species = $state(speciesLaunchCompat['trinidad'][0]);

  $effect(() => {
    const parsed = parseRulesParams(window.location.search);
    launch = parsed.launch;
    species = parsed.species;
  });

  const validSpecies = $derived(speciesLaunchCompat[launch]);
  const launchOptions = (Object.keys(launches) as LaunchId[]).map((id) => ({ id, label: launches[id].label }));
  // Device-date season check — pure date math, works offline.
  const todayISO = $derived(new Date().toISOString().slice(0, 10));
  const seasonOpen = $derived(isSpeciesOpen(species, todayISO, launch).open);
  const guide = $derived(idGuideForLaunch(launch));

  function pickSpecies(s: Species) {
    species = s;
    const qs = new URLSearchParams({ species: s, launch });
    history.replaceState({}, '', `/rules?${qs.toString()}`);
  }
  function pickLaunch(id: LaunchId) {
    launch = id;
    if (!speciesLaunchCompat[id].includes(species)) species = speciesLaunchCompat[id][0];
    const qs = new URLSearchParams({ species, launch: id });
    history.replaceState({}, '', `/rules?${qs.toString()}`);
  }
</script>

<svelte:head><title>What can I keep? · Humboldt Fish</title></svelte:head>

<main class="mx-auto max-w-xl p-3">
  <header class="mb-3 flex items-center justify-between">
    <h1 class="text-lg font-bold">What can I keep?</h1>
    <a class="rounded-full bg-neutral-100 px-3 py-1 text-sm underline" href={`/?species=${species}&launch=${launch}`}>← Verdict</a>
  </header>

  <select
    class="mb-2 w-full rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-sm"
    value={launch}
    onchange={(e) => pickLaunch((e.currentTarget as HTMLSelectElement).value as LaunchId)}
  >
    {#each launchOptions as o}<option value={o.id}>{o.label}</option>{/each}
  </select>

  <div class="mb-3 flex flex-wrap gap-1 rounded-2xl bg-neutral-100 p-1 text-sm">
    {#each validSpecies as s}
      <button
        type="button"
        class={`whitespace-nowrap rounded-full px-3 py-1 ${species === s ? 'bg-white font-semibold shadow' : 'text-neutral-600'}`}
        onclick={() => pickSpecies(s)}
      >
        {SPECIES_LABEL[s]}
      </button>
    {/each}
  </div>

  <CatchRulesCard
    label={regs[species].label}
    rules={regs[species].rules}
    meta={regs[species].meta}
    mode="full"
    {seasonOpen}
    idGuide={guide}
  />
</main>
```

- [ ] **Step 3: Verify it builds + prerenders.**

Run: `pnpm run build`
Expected: build succeeds; output log lists `/rules` among prerendered pages (look for a `.svelte-kit/output/prerendered/.../rules` entry or a "Prerendered … /rules" line). If SvelteKit complains the route can't be prerendered, confirm `+page.ts` exports `prerender = true` and that nothing in the route reads `url.searchParams` server-side (it must not — params are read in `$effect` client-side).

- [ ] **Step 4: Typecheck.**

Run: `pnpm run check`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add src/routes/rules/
git commit -m "feat: prerendered /rules reference route"
```

---

# Phase 5 — Integration into the existing UI

### Task 10: Embed the compact card in DayCard

**Files:**
- Modify: `src/lib/components/DayCard.svelte`

- [ ] **Step 1: Add a `launch` prop.** In the `<script>` block of `src/lib/components/DayCard.svelte`, add `LaunchId` to the type import and a `launch` prop. Change the import line:

```typescript
  import type { Verdict, Species, DataSources, LaunchWindow, NowVerdict, LaunchId } from '$lib/types.js';
```

Add `CatchRulesCard` + config imports below the existing imports:

```typescript
  import CatchRulesCard from './CatchRulesCard.svelte';
  import { SPECIES_LABEL } from '$lib/config/species-labels.js';
```

Add `launch` to the `Props` type and the `$props()` destructure:

```typescript
  type Props = {
    verdict: Verdict;
    species: Species;
    launch: LaunchId;
    launchLabel: string;
    mode?: 'today' | 'row';
    lowConfidence?: boolean;
    nowMs?: number;
    now?: NowVerdict | null;
  };
  let { verdict, species, launch, launchLabel, mode = 'row', lowConfidence = false, nowMs, now = null }: Props = $props();
```

> Note: also fixes the existing default-value typo `mode = 'mode'` → `mode = 'row'`.

- [ ] **Step 2: Insert the compact card.** In the template, immediately **after** the tidal-currents block (around line 252) and **before** the gear-pack `<details>` (around line 254), add:

```svelte
    <CatchRulesCard
      label={regs[species].label}
      rules={regs[species].rules}
      meta={regs[species].meta}
      mode="compact"
      rulesHref={`/rules?species=${species}&launch=${launch}`}
    />
```

(`regs` is already imported in DayCard.) `SPECIES_LABEL` is imported for parity with future use; if `svelte-check` flags it as unused, drop that import.

- [ ] **Step 3: Typecheck.** (DayCard's call sites in `+page.svelte` now need `launch` — that is Task 11. `check` will fail here until then; that is expected.)

Run: `pnpm run check`
Expected: errors ONLY about `DayCard` missing the `launch` prop at its call sites in `+page.svelte`. No other errors.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/components/DayCard.svelte
git commit -m "feat: embed compact catch-rules card in DayCard"
```

---

### Task 11: Wire `launch` + header Rules link in the page

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Pass `launch` to every `<DayCard>`.** Find each `<DayCard … />` usage in `src/routes/+page.svelte` and add `{launch}` to its props (alongside the existing `{species}` / `launchLabel`). There are two render sites (the "today" card and the "next days" loop) — update both.

- [ ] **Step 2: Add the header Rules link.** In the sticky `<header>` (after the launch `<select>`, before the refresh `<button>`), add:

```svelte
    <a
      href={`/rules?species=${species}&launch=${launch}`}
      class="rounded-full bg-neutral-100 px-3 py-1 text-sm"
      data-sveltekit-preload-data="hover"
    >
      Rules
    </a>
```

- [ ] **Step 3: Typecheck + full suite.**

Run: `pnpm run check && pnpm test`
Expected: `check` clean; all tests green.

- [ ] **Step 4: Visual confirmation (ask the user — do NOT background a dev server yourself).** Per CLAUDE.md, ask the user to run `pnpm run dev:clean` in a fresh terminal and confirm: (a) each day card shows a collapsible "What can I keep?" that expands to size/keep/release + a "Full rules ↗" link; (b) the header "Rules" link opens `/rules` with the current species/launch preselected; (c) at Big Lagoon + cutthroat the `/rules` page shows the "Which trout do I have?" block with the release-when-uncertain banner.

- [ ] **Step 5: Commit.**

```bash
git add src/routes/+page.svelte
git commit -m "feat: pass launch to DayCard; add header Rules link"
```

---

# Phase 6 — PWA / offline

### Task 12: Install + configure SvelteKitPWA

**Files:**
- Modify: `package.json` (via package manager)
- Modify: `vite.config.ts`
- Modify: `src/app.html`

- [ ] **Step 1: Add the dev dependencies.**

```bash
pnpm add -D @vite-pwa/sveltekit @vite-pwa/assets-generator
```

Expected: `@vite-pwa/sveltekit` and `@vite-pwa/assets-generator` appear in `devDependencies`.

- [ ] **Step 2: Configure the plugin.** Replace `vite.config.ts` with:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Humboldt Fish',
        short_name: 'Fish',
        description: 'Should I fish tomorrow? Live North Coast go/no-go + catch rules.',
        theme_color: '#0c4a6e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Leave globPatterns to the plugin's smart defaults — @vite-pwa/sveltekit
        // precaches BOTH client/** (app shell + bundled regs/identification) and
        // prerendered/** (the static /rules HTML) under .svelte-kit/output. A flat
        // custom pattern like ['**/*...'] misses those client//prerendered prefixes,
        // so do NOT set globPatterns here.
        navigateFallback: '/',
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // The live verdict — best-effort offline (serve last good response).
            urlPattern: /\/api\/verdict/,
            handler: 'NetworkFirst',
            options: { cacheName: 'verdict', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 } }
          }
        ]
      }
    })
  ]
});
```

- [ ] **Step 3: Add iOS/theme meta to `src/app.html`.** Inside `<head>`, before `%sveltekit.head%`, add:

```html
		<meta name="theme-color" content="#0c4a6e" />
		<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 4: Typecheck.**

Run: `pnpm run check`
Expected: clean (the plugin ships its own virtual-module types via `@vite-pwa/sveltekit`).

- [ ] **Step 5: Commit.**

```bash
git add package.json pnpm-lock.yaml vite.config.ts src/app.html
git commit -m "feat: install + configure SvelteKitPWA (generateSW, verdict NetworkFirst)"
```

---

### Task 13: Generate PWA icons

**Files:**
- Create: `static/pwa-192x192.png`, `static/pwa-512x512.png`, `static/apple-touch-icon-180x180.png`, `static/favicon.ico` (generated)
- Create: `pwa-assets.config.ts`
- Create: `static/logo.svg` (source mark, if none exists)

- [ ] **Step 1: Provide a source mark.** If `static/logo.svg` does not exist, create a simple square SVG (a fish glyph on the `#0c4a6e` theme) at `static/logo.svg`, at least 512×512 viewBox. Keep it minimal — it is only the icon source.

- [ ] **Step 2: Add the assets config** `pwa-assets.config.ts`:

```typescript
import { defineConfig, minimalPreset as preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset,
  images: ['static/logo.svg']
});
```

- [ ] **Step 3: Generate the icons.**

```bash
pnpm exec pwa-assets-generator
```

Expected: writes `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon-180x180.png`, and a favicon into `static/`. Confirm the filenames match the `manifest.icons` and `app.html` references from Task 12; rename or adjust references if the generator's defaults differ.

- [ ] **Step 4: Build to confirm icons + manifest are emitted.**

Run: `pnpm run build`
Expected: build succeeds; `manifest.webmanifest` and the `pwa-*` icons are in the client output.

- [ ] **Step 5: Commit.**

```bash
git add pwa-assets.config.ts static/
git commit -m "feat: generate PWA icon assets"
```

---

### Task 14: Offline acceptance gate

**Files:** none (verification task — the flagged Cloudflare × PWA integration risk)

- [ ] **Step 1: Build and locate artifacts.**

```bash
pnpm run build
```

Confirm in the output dir: (a) a service worker file (`sw.js`) exists; (b) `manifest.webmanifest` exists; (c) `/rules` is in the prerendered output.

- [ ] **Step 2: Confirm the precache manifest covers the reference.** Inspect the generated `sw.js` (or the precache manifest it references): the precache list must include the `/rules` HTML and the hashed JS chunk(s) that contain `config/regs` + `config/identification`. If `/rules` is missing, confirm it was prerendered (Task 9 `prerender = true`) and that the plugin's default `prerendered/**/*.{html,json}` glob is active (i.e. you did **not** override `globPatterns`).

- [ ] **Step 3: Manual offline check.** Ask the user to run `pnpm run dev:clean` (or `pnpm run preview` after a build) in a fresh terminal, then in the browser: load `/`, load `/rules`, open DevTools → Application → confirm the service worker is activated and the app is installable; then DevTools → Network → set **Offline**, reload `/rules`, and confirm the full catch rules + ID guide still render. Confirm the main `/` page, when offline, shows the existing staleness/degraded banner rather than a hard error.

- [ ] **Step 4: Record the result.** If offline `/rules` works, note it in the PR description as the acceptance evidence. If it fails on the Cloudflare adapter specifically, capture the error and consult `@vite-pwa/sveltekit` docs for adapter-cloudflare (`globDirectory` / `outDir` overrides) before proceeding — this is the known integration risk from the spec.

- [ ] **Step 5: Commit** any config adjustment made to pass the gate.

```bash
git add -A
git commit -m "chore: verify offline /rules precache (acceptance gate)"
```

(If no change was needed, skip the commit.)

---

# Phase 7 — Docs & conventions

### Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Retire the Claude.ai round-trip convention.** In the **Project conventions** section, replace the bullet that begins *"Reference files are read-only inside Claude Code sessions …"* with:

```markdown
- **This repo is canonical for regulations.** `reference/regs/*.md` is the human-readable canonical layer; `src/lib/config/*` is its typed mirror. Edit both **here, in the same commit** when a rule changes. The old Claude.ai round-trip is retired — Phase 3's MCP server inverts the dependency (Claude.ai will *consume* this tool). Conservative defaults still bind: surface unverified/historical values with a visible "verify" badge, never as confirmed law.
```

- [ ] **Step 2: Register the new surface.** In the **Current phase** / Phase 2 description, add a line:

```markdown
- **Catch-rules reference (shipped):** typed `CatchRules` per species (size/bag/gear/retention + per-field confidence), shown compact in each day card and full on the offline-capable `/rules` route (installable PWA). Lagoon stock-vs-wild trout ID guide included; full steelhead regs are a fast-follow.
```

- [ ] **Step 3: Note the PWA in the structure notes.** Under **Project conventions** (code layout bullet), append: `The /rules route (src/routes/rules/) is prerendered and precached by the service worker (@vite-pwa/sveltekit) for offline use.`

- [ ] **Step 4: Full verification.**

Run: `pnpm run check && pnpm test && pnpm run build`
Expected: all green; build emits SW + manifest + prerendered `/rules`.

- [ ] **Step 5: Commit.**

```bash
git add CLAUDE.md
git commit -m "docs: repo is canonical for regs; register /rules + PWA"
```

---

## Definition of done

- All acceptance criteria in the spec are met (see `docs/superpowers/specs/2026-06-15-catch-rules-reference-design.md`).
- `pnpm run check`, `pnpm test`, and `pnpm run build` are green.
- Offline `/rules` renders catch rules + ID guide with the network throttled to offline (Task 14).
- `computeVerdict` outcomes are unchanged (no verdict test regressions — catch rules are display-only).
- `reference/regs/*.md` and `src/lib/config/*` are consistent; CLAUDE.md reflects the canonical-source change.
- Branch `feat/catch-rules-reference` is ready for a PR (open it only when the user asks).
