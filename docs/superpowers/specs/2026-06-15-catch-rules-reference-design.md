# Catch-Rules Reference — Design Spec

**Date:** 2026-06-15
**Status:** Approved design, pre-implementation
**Topic:** Surface catch regulations (size / bag / gear / retention) as a pre-trip + post-catch reference, offline-capable, with stock-vs-wild identification help for the lagoon trout.

---

## Problem

The tool answers "should I fish tomorrow?" but says nothing about "I caught a fish — what can I keep?" The motivating case: the user caught a trout at Big Lagoon and had no reference for size limit, bag limit, or whether it was a keepable stocked fish vs a protected wild one.

The striking finding from mapping the codebase: **the data already exists and is dead config.** Every species in `src/lib/config/regs.ts` carries a `requirements: string[]` array holding exactly these rules (size limits, bag/possession, sub-limits, no-retention species, gear, license, stock-vs-wild notes). A grep confirms `requirements` has **zero readers** outside `regs.ts` — it compiles into the bundle and is never rendered. So this is primarily a **surfacing** problem, not a data-collection one.

The user's exact case is already modeled (just hidden): Big Lagoon trout = `cutthroat` — daily bag **1 fish**, artificial-lure single-barbless, **~14″ historical min** (flagged "verify 2026"), tagged a conservation-concern catch-and-release-encouraged species. Stocked `rainbow-trout` (5/day) is modeled only at Freshwater Lagoon. The stock-vs-wild axis the user hit is real — and the hardest part, because identifying a wild cutthroat vs a stray rainbow/steelhead is **not** modeled yet.

---

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| When is the reference needed? | **Both** pre-trip (in the verdict) and post-catch (standalone), same data, two entry points — with an **offline** requirement. |
| How robust is offline? | **Full installable PWA.** The catch rules are static, so they can be a hard offline guarantee even though the live verdict cannot. |
| Where is regs data authored? | **This repo is now canonical.** The Claude.ai round-trip is retired — Phase 3's MCP server inverts the dependency (Claude.ai will *consume* this tool). `reference/regs/*.md` stays the human-readable canonical layer; `config/*` is its typed mirror; both edited here in the same commit. |
| v1 scope | **Surface + ID.** Render all existing rules (restructured + confidence-flagged), full PWA, and author the lagoon stock-vs-wild identification guidance. Full **steelhead regs modeling = fast-follow.** |
| Approach | **Option A — shared model + shared component, two density modes.** |

### Approaches considered
- **A (chosen):** one `CatchRules` model, one `<CatchRulesCard>` component with compact + full modes. DRY; the two surfaces cannot drift; the prerendered `/rules` route caches cleanly for offline.
- **B:** `/rules` is the hub; the DayCard shows only a teaser linking to it. Cleaner separation but two representations to maintain and a teaser that can drift.
- **C:** in-verdict only — emit rules as rows in the four-layer table, no dedicated route. Smallest diff, but buries size/bag inside an expandable verdict (wrong ergonomics for "fish in hand") and fails the standalone-offline requirement.

---

## Goals

1. Surface every species' catch rules in a clear, structured, confidence-flagged form.
2. Make those rules reachable in two moments from one source of truth: pre-trip (inside the DayCard) and post-catch (a one-tap standalone `/rules` view).
3. Guarantee the catch reference works offline at a no-signal launch (installable PWA).
4. Help the user tell a wild cutthroat from a stocked rainbow from a steelhead at the lagoons, defaulting to release when uncertain.
5. Never present unverified/historical values as confirmed law.

## Non-goals (v1)

- **Not** turning size/bag/gear into go/no-go gates. Catch rules are **display-only**; the verdict logic and the conservative four-layer outcomes are unchanged.
- **Not** full steelhead regulation modeling (fast-follow). The steelhead *ID candidate* ships in v1; its full reg file does not.
- **Not** a live regulatory feed. Season open/closed stays a static date-window lookup (computable offline); in-season closures remain "verify" pointers.

---

## Architecture overview (Option A)

```
reference/regs/*.md                 canonical, human-readable (drift anchor)
reference/regs/lagoon-trout-id-2026.md   NEW — stock-vs-wild ID content
        │  (mirrored, same commit)
        ▼
src/lib/config/regs.ts              typed mirror: SpeciesRegs.rules + .meta  (requirements[] removed)
src/lib/config/identification.ts    NEW — launch-keyed IdGuide[]
        │
        ▼
src/lib/components/CatchRulesCard.svelte   ONE component, mode: 'compact' | 'full'
        ├── RegRow.svelte           one rule line + value + VerifyBadge
        └── VerifyBadge.svelte      confidence chip → meta.sourceUrl
        │
        ├─ embedded compact in  → src/lib/components/DayCard.svelte   (pre-trip)
        └─ rendered full in     → src/routes/rules/+page.svelte       (post-catch, prerendered)

vite.config — SvelteKitPWA (generateSW): precache app shell + /rules; NetworkFirst for /api/verdict
```

---

## Section 1: Data model

Replace the untyped `requirements: string[]` with a typed `CatchRules` structure plus per-field confidence, derived from the canonical markdown. Hedge language ("historically", "verify 2026", DRAFT) becomes structured `confidence`, not lost prose.

```ts
// A regulatory value that may be confirmed-for-2026 or merely last-known.
// Drives the "Verify" badge — the conservative ethos made machine-readable.
interface RegValue<T> {
  value: T;
  confidence: 'confirmed' | 'historical' | 'unverified';
  note?: string;                  // "Big Lagoon historically", "Northern Mgmt Area"
}

interface SizeLimit { minInches?: number; measure?: string; none?: boolean; }
interface BagLimit  { daily?: number; possession?: number; unit?: string; none?: boolean; }
interface SubLimit  { species: string; daily: number; note?: string; }

interface CatchRules {
  size:        RegValue<SizeLimit>;
  bag:         RegValue<BagLimit>;
  subLimits?:  RegValue<SubLimit[]>;     // rockfish vermilion+sunset 4, copper 1, canary 2…
  prohibited?: string[];                 // zero-retention: coho, quillback, yelloweye, cowcod…
  gear?:       RegValue<string[]>;       // "single-point barbless", "artificial lure only"
  license:     string[];                 // license / stamp / Pacific Halibut Card
  otherRules?: string[];                 // catch-all w/o a typed home: descender device,
                                         // "one rod per angler", "check CDPH domoic-acid"
}

// Verification metadata, lifted verbatim from each markdown header.
interface RegMeta { lastUpdated: string; draft: boolean; sourceUrl: string; }
```

`SpeciesRegs` drops `requirements[]` and gains `rules: CatchRules` + `meta: RegMeta`. `seasonWindows`, `perLaunchSeasonWindows`, the hotline fields, and `isSpeciesOpen()` are untouched. Removing `requirements` is safe (zero external readers, confirmed by grep).

**Two deliberate calls:**
- **Per-field confidence, not per-species.** Cutthroat's *license* is confirmed while its *size* is historical; a single species-level draft flag would mislabel the license. Confidence rides on each `RegValue`.
- **Stock-vs-wild ID lives in its own launch-keyed unit, not inside a species** — it spans species and is anchored to the launch (Section 4).

---

## Section 2: Components & routes

One component, two density modes, plus two leaf components so confidence rendering lives in one place.

```
CatchRulesCard (mode: 'compact' | 'full')
├── RegRow       — one rule line: label + value + VerifyBadge
└── VerifyBadge  — 'historical'/'unverified' → "Verify ↗" chip → meta.sourceUrl
```

**Pre-trip (compact):** a collapsible "What can I keep?" section inside the existing `DayCard`, below the four-layer table, **collapsed by default** (the night before you mostly want go/no-go). One-line teaser → expands to the structured fields → "Full rules ↗" deep-links to `/rules`.

```
┌─ DayCard (Big Lagoon · Cutthroat) ───────────────┐
│  [GO]  Light wind, lagoon calm…                   │
│  ▸ Legal  ▸ Safety  ▸ Quality  ▸ Logistics        │
│  ▾ What can I keep?                                │
│     Cutthroat — keep 1/day, ≥14″ ⚠Verify, barbless │
│     Release encouraged (conservation)   Full rules↗│
└───────────────────────────────────────────────────┘
```

**Post-catch (full):** a dedicated, **prerendered** `/rules` route (`export const prerender = true`), reachable in **one tap** from a persistent "Rules" button in the sticky header and the natural landing surface for the installed PWA icon. Deep-linkable: `/rules?species=cutthroat&launch=big-lagoon`, defaulting to the main page's current selection.

```
┌─ /rules ─────────────────────────────────────────┐
│  What can I keep?         Big Lagoon ▾             │
│  ( rockfish )( lingcod )(•cutthroat•)( surfperch ) │
│  ┌───────────────────────────────────────────────┐ │
│  │ Coastal Cutthroat Trout        Season: OPEN   │ │
│  │ ───────────────────────────────────────────── │ │
│  │ SIZE     ≥ 14″ total      ⚠ Verify ↗          │ │
│  │ KEEP     1 / day · 1 possession  ⚠ Verify ↗   │ │
│  │ GEAR     artificial lure, single barbless     │ │
│  │ RELEASE  C&R encouraged — conservation species│ │
│  │ LICENSE  CA Sport Fishing (16+)               │ │
│  │ ───────────────────────────────────────────── │ │
│  │ ⚠ Which fish do I have?  cutthroat vs rainbow ↗│ │
│  │ Draft · updated 2026-05-17 · verify at CDFW ↗  │ │
│  └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**Post-catch ergonomics:** (1) size + keep/release sit at the *top* of the full card — the rules that matter with a fish in hand; (2) season open/closed is computed offline from the device date (pure date math, no network); (3) the species picker is always visible because you may land something you weren't targeting.

Compact and full render from the same `CatchRules` through the same component — they cannot drift.

---

## Section 3: PWA / offline

`@vite-pwa/sveltekit` (`SvelteKitPWA`), `generateSW` strategy. The entire regs dataset compiles into the JS bundle (`config/regs.ts`), so precaching the app shell makes every rule available offline — no separate data sync, no API for the rules.

```ts
// vite.config
SvelteKitPWA({
  strategies: 'generateSW',
  registerType: 'autoUpdate',          // new regs ship → SW self-updates next launch
  manifest: { name: 'Humboldt Fish', short_name: 'Fish', display: 'standalone',
              start_url: '/', theme_color: '…', background_color: '…',
              icons: [/* 192, 512, maskable */] },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],   // app shell + bundled regs → precached
    navigateFallback: '/',
    runtimeCaching: [{
      urlPattern: /\/api\/verdict/,    // LIVE data — best-effort only
      handler: 'NetworkFirst',
      options: { cacheName: 'verdict', expiration: { maxEntries: 8 } },
    }],
  },
})
```

**Two-tier offline contract:**
- **Catch rules + `/rules`** → *precached*. Hard offline guarantee after first load, network-independent. This is the "fish in hand, no bars" promise.
- **Live verdict** → *NetworkFirst runtime cache*. Offline serves the last-fetched verdict behind the app's existing **staleness/degraded banner** (reuse `staleness` / `DataSources`) — never presents stale conditions as fresh.

**Supporting pieces:** `/rules` prerendered static; season open/closed computable offline; icon assets (192 / 512 / maskable / apple-touch) generated from one source image via `@vite-pwa/assets-generator`.

**Integration risk (explicit gate, not assumption):** the `@vite-pwa/sveltekit` docs assume `adapter-static`; this project uses `adapter-cloudflare`. The SW precache-manifest + prerendered `/rules` + Cloudflare Pages must be verified together — SW at root scope, correct headers, no conflict with SvelteKit's built-in `$service-worker`. Acceptance test: "PWA installs and `/rules` renders with network throttled to offline."

---

## Section 4: Stock-vs-wild identification

Its own launch-keyed unit. Legally consequential, so the design leans on the conservative ethos: structure the comparison, source every claim, default to release when uncertain.

```ts
// config/identification.ts  ↔  reference/regs/lagoon-trout-id-2026.md
interface IdCandidate {
  name: string;                  // "Coastal cutthroat trout"
  scientific?: string;           // "Oncorhynchus clarkii clarkii"
  origin: 'wild' | 'stocked' | 'anadromous';
  tells: RegValue<string[]>;     // field marks — confidence-flagged like everything else
  ruleSummary: string;           // "1/day · barbless · C&R encouraged"
  rulesSpecies?: Species;        // deep-link to full CatchRules (cutthroat, rainbow-trout)
}
interface IdGuide {
  id: string; title: string;
  appliesToLaunches: LaunchId[];           // big-lagoon, stone-lagoon, freshwater-lagoon
  candidates: IdCandidate[];
  whenUncertain: string;                   // conservative default, surfaced prominently
  meta: RegMeta;
}
export const idGuides: IdGuide[];
export function idGuideForLaunch(launch: LaunchId): IdGuide | undefined;
```

**Three candidates at the lagoons:**
1. **Coastal cutthroat** (wild, conservation-concern) — namesake red-orange throat slash.
2. **Rainbow trout** (stocked at Freshwater Lagoon) — pink lateral stripe, no slash.
3. **Steelhead** (anadromous rainbow, sea-run *O. mykiss*) — *is* a rainbow but wild vs hatchery retention differs; the **adipose-fin clip** (healed scar behind the dorsal) is the key hatchery tell.

**Why it's hard / the conservative default:** cutthroat and rainbow hybridize in these lagoons, so the slash isn't always definitive. The guide leads with:

> **`whenUncertain`:** "Cutthroat and rainbow hybridize here. If you can't positively confirm the fish, release it — cutthroat is a conservation-concern species and the 1-fish limit is unforgiving."

**Sourcing discipline:** no field marks or retention specifics asserted from memory. During implementation each `tells[]` and rule is authored from **CDFW District 1 / coastal regs** (WebFetch to authoritative pages), carries a `confidence` flag + `meta.sourceUrl`; anything unverifiable ships as `'unverified'` with a visible Verify chip. The adipose-clip and hybridization points are the established anchors; the rest is verified, not guessed.

**Surfacing:** `/rules` shows a prominent "⚠ Which fish do I have?" block (side-by-side candidate cards + release-when-unsure banner on top) whenever the launch is a lagoon or a trout species is selected; the compact DayCard card carries a "Which fish do I have? ↗" deep-link into it. Steelhead's full regs link to the fast-follow file; its ID candidate ships in v1.

---

## Section 5: Testing, mirror discipline, CLAUDE.md

**Testing (Vitest, extends existing suite):**
- **Migration safety (load-bearing):** every fact in the old `requirements[]` lands somewhere in the new `rules`/`otherRules` — per-species no-drop assertion. Plus: every `Species` has `rules` + `meta`; every `RegValue` has a valid `confidence`; every `meta.sourceUrl` parses.
- **Verdict unchanged:** regression test proving catch rules are display-only — `computeVerdict` outcomes and the four-layer checks are identical before/after. Surfacing ≠ gating.
- **ID guide:** `idGuideForLaunch` returns the lagoon guide for the three lagoons; every `rulesSpecies` resolves to a real species; `whenUncertain` non-empty.
- **Component:** `CatchRulesCard` renders compact vs full; `VerifyBadge` shows for `historical`/`unverified`, hidden for `confirmed`; `/rules` deep-link params parse.
- **Offline acceptance (scripted browser step):** build emits SW + manifest; `/rules` prerendered to static HTML; precache manifest includes regs bundle + `/rules`; throttle-to-offline → `/rules` renders.

**Mirror discipline:** every reg edit touches the canonical markdown *and* its typed mirror in the same commit.
- `reference/regs/*.md` ↔ `config/regs.ts`
- `reference/regs/lagoon-trout-id-2026.md` ↔ `config/identification.ts` (new)

`meta` is lifted verbatim from each markdown header, so the header is the drift anchor.

**CLAUDE.md change:** retire the "reference files are read-only / edit in Claude.ai then copy back" convention. New: this repo is canonical for regs; `reference/regs/*.md` is the human-readable canonical layer and `config/*` its typed mirror, both edited here; the Claude.ai round-trip is gone because Phase 3's MCP server inverts the dependency. Reaffirm conservative defaults. Register the new `/rules` route + PWA in project-structure notes.

---

## Acceptance criteria

1. Every species shows structured size / bag / sub-limits / prohibited / gear / license / other rules in the `/rules` view, each historical/unverified value carrying a visible Verify chip linking to its source.
2. The compact "What can I keep?" card appears in each DayCard for the selected species and deep-links to `/rules`.
3. `/rules` is reachable in one tap from the sticky header and from the installed PWA icon.
4. With the network throttled to offline after one load, `/rules` and all catch rules render fully; the live verdict degrades gracefully behind the staleness banner.
5. At a lagoon launch, the "Which fish do I have?" block compares cutthroat / rainbow / steelhead and leads with the release-when-uncertain default.
6. `computeVerdict` outcomes are byte-identical to pre-change for the existing test cases (no new gating).
7. Full test suite green; `reference/regs/*.md` and `config/*` consistent.

## Risks / open items

- **Cloudflare adapter × PWA** — primary technical risk; gated by the offline acceptance test above.
- **ID content authority** — must be CDFW-sourced during implementation; unverifiable claims ship as `'unverified'`, not omitted-and-implied-safe.
- **Steelhead full regs** — deferred to fast-follow; v1 ships only the ID candidate.

## Rough file inventory

- **New:** `src/lib/config/identification.ts`, `src/routes/rules/+page.svelte` (+ `+page.ts` for prerender), `src/lib/components/CatchRulesCard.svelte`, `RegRow.svelte`, `VerifyBadge.svelte`, `reference/regs/lagoon-trout-id-2026.md`, PWA icon assets.
- **Changed:** `src/lib/config/regs.ts` — define `RegValue` / `SizeLimit` / `BagLimit` / `SubLimit` / `CatchRules` / `RegMeta` beside the existing `SpeciesRegs` (which already lives here, not in `types.ts`), reshape `SpeciesRegs`, and migrate all 12 species off `requirements[]`; `src/lib/components/DayCard.svelte` — embed compact card; `src/routes/+page.svelte` — header "Rules" link; `vite.config.*` — SvelteKitPWA; `reference/regs/*.md` — add `meta` headers where missing; `CLAUDE.md` — canonical-source convention change.
</content>
</invoke>
