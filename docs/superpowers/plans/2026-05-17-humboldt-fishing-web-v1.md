# Humboldt Fishing Checker — Web v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first website at `humboldt.fish` that renders a four-layer go/no-go verdict for kayak fishing out of Trinidad Harbor across the next 5–7 days, pulling live NOAA data through a Cloudflare Pages Function.

**Architecture:** SvelteKit + TypeScript at the repo root, deployed to Cloudflare Pages via `@sveltejs/adapter-cloudflare`. A single `+page.server.ts` SSR loader calls the same logic as the public `/api/verdict` endpoint, which orchestrates parallel fetchers (NDBC buoys, NWS marine + point forecasts, NOAA tides), validates responses with Zod, caches at the edge with per-source TTLs via the Cloudflare Cache API, and feeds a pure `computeVerdict()` module that returns one structured `Verdict` per day.

**Tech Stack:** SvelteKit, TypeScript, `@sveltejs/adapter-cloudflare`, Tailwind CSS, Vitest, Zod, `suncalc`, Cloudflare Pages + Pages Functions.

**Reference docs the engineer must read before starting:**
- `reference/SKILL.md` — four-layer framework, fail-stop logic
- `reference/thresholds.md` — every threshold number and the permanent user rules
- `reference/launches.md` — Trinidad Harbor's profile and the launch rules
- `reference/data-sources.md` — NOAA endpoints, station IDs, the **PZZ450 not PZZ455** gotcha
- `reference/decision-template.md` — the canonical output format
- `reference/regs/rockfish-lingcod-2026-northern.md` and `reference/regs/salmon-2026-kmz.md`
- `docs/superpowers/specs/2026-05-17-humboldt-fishing-web-v1-design.md` — the design this plan implements

---

## Task 0: Scaffold SvelteKit project and install dependencies

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`, `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `.gitignore` (merge with existing), `wrangler.toml`
- Test: `tests/scaffolding.test.ts` (smoke test: project builds)

- [ ] **Step 1: Initialize SvelteKit at the repo root**

Run from `/home/samwedll/projects/humboldt-fishing-checker`:

```bash
npm create svelte@latest .
# Choose: Skeleton project, TypeScript, ESLint=No (Vitest provides what we need), Prettier=Yes, Playwright=No, Vitest=Yes
# When prompted that the directory is not empty, accept (reference/, docs/, CLAUDE.md etc. stay)
```

If `npm create svelte@latest` is no longer available (renamed to `npx sv create`), use:

```bash
npx sv create . --template skeleton --types ts --no-add-ons --install npm
```

- [ ] **Step 2: Install the Cloudflare adapter and core deps**

```bash
npm install -D @sveltejs/adapter-cloudflare wrangler
npm install -D tailwindcss postcss autoprefixer
npm install zod suncalc
npm install -D @types/suncalc
```

- [ ] **Step 3: Configure the Cloudflare adapter**

Replace the auto-generated `svelte.config.js` with:

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: { include: ['/*'], exclude: ['<all>'] }
    })
  }
};

export default config;
```

- [ ] **Step 4: Initialize Tailwind**

```bash
npx tailwindcss init -p
```

Replace `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        verdict: {
          go: '#16a34a',         // green-600
          conditional: '#ca8a04', // yellow-600
          nogo: '#dc2626',       // red-600
          incomplete: '#737373'  // neutral-500
        }
      }
    }
  },
  plugins: []
};
```

Replace `src/app.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
```

Create `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
</script>

<slot />
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false
  }
});
```

- [ ] **Step 6: Add npm scripts**

Edit `package.json` `scripts` section to include:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "tsx scripts/smoke.ts"
  }
}
```

Install `tsx` for the smoke script:

```bash
npm install -D tsx
```

- [ ] **Step 7: Add wrangler.toml for Cloudflare Pages**

Create `wrangler.toml`:

```toml
name = "humboldt-fishing-checker"
compatibility_date = "2026-05-01"
pages_build_output_dir = ".svelte-kit/cloudflare"
```

- [ ] **Step 8: Write the scaffolding smoke test**

Create `tests/scaffolding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('project scaffolding', () => {
  it('package.json declares required deps', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    expect(pkg.devDependencies['@sveltejs/adapter-cloudflare']).toBeTruthy();
    expect(pkg.devDependencies['tailwindcss']).toBeTruthy();
    expect(pkg.devDependencies['vitest']).toBeTruthy();
    expect(pkg.dependencies['zod']).toBeTruthy();
    expect(pkg.dependencies['suncalc']).toBeTruthy();
  });
});
```

- [ ] **Step 9: Run tests and verify scaffolding works**

```bash
npm test
```

Expected: 1 test passes.

```bash
npm run build
```

Expected: Build succeeds, output goes to `.svelte-kit/cloudflare/`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold SvelteKit + Cloudflare Pages + Tailwind + Vitest"
```

---

## Task 1: Define core domain types

**Files:**
- Create: `src/lib/types.ts`
- Test: `tests/lib/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/types.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/types.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement types**

Create `src/lib/types.ts`:

```ts
export type Species = 'rockfish' | 'lingcod' | 'salmon';
export type LaunchId = 'trinidad';
export type VerdictLabel = 'GO' | 'CONDITIONAL' | 'NO-GO' | 'INCOMPLETE';
export type LayerStatus = 'pass' | 'warn' | 'fail' | 'incomplete';
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';
export type LayerName = 'legal' | 'safety' | 'quality' | 'logistics';

export interface LayerResult {
  status: LayerStatus;
  summary: string;
}

export interface Check {
  layer: LayerName;
  name: string;
  value: string;
  threshold: string;
  status: CheckStatus;
  note?: string;
}

export interface Recommendations {
  window?: string;
  gear?: string[];
  bailout?: string;
}

export interface Verdict {
  date: string; // YYYY-MM-DD, Pacific time
  verdict: VerdictLabel;
  reason: string;
  layers: Record<LayerName, LayerResult>;
  checks: Check[];
  recommendations: Recommendations;
}

export interface SourceFreshness {
  ndbc46244?: string;
  ndbc46022?: string;
  nwsZone?: string;
  nwsPoint?: string;
  tides?: string;
  suntimes?: string;
}

export interface VerdictResponse {
  generatedAt: string;
  freshness: SourceFreshness;
  days: Verdict[];
}

export interface FetchedData {
  ndbc46244: NdbcObservation | null;
  ndbc46022: NdbcObservation | null;
  nwsZone: NwsZoneForecast | null;
  nwsPoint: NwsPointForecast | null;
  tides: TidePredictions | null;
  suntimes: SunTimes;
}

export interface NdbcObservation {
  observedAt: string;       // ISO
  windKt: number | null;
  gustKt: number | null;
  windDirDeg: number | null;
  waveHtFt: number | null;
  dominantPeriodSec: number | null;
  meanWaveDirDeg: number | null;
  waterTempF: number | null;
}

export interface NwsZonePeriod {
  number: number;
  name: string;             // "Tonight", "Sunday"
  startTime: string;        // ISO
  endTime: string;
  detailedForecast: string;
}

export interface NwsZoneForecast {
  zone: string;             // "PZZ450"
  updated: string;          // ISO
  periods: NwsZonePeriod[];
}

export interface NwsPointPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  windSpeed: string;        // "5 to 10 mph"
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
}

export interface NwsPointForecast {
  updated: string;
  periods: NwsPointPeriod[];
}

export interface TideEvent {
  time: string;             // ISO
  height: number;           // feet, MLLW
  type: 'H' | 'L';
}

export interface TidePredictions {
  station: string;
  events: TideEvent[];
}

export interface SunTimes {
  // map of YYYY-MM-DD to civil dawn/sunrise/sunset/civil dusk
  byDate: Record<string, {
    civilDawn: string;
    sunrise: string;
    sunset: string;
    civilDusk: string;
  }>;
}

const LAYER_STATUSES: LayerStatus[] = ['pass', 'warn', 'fail', 'incomplete'];
const VERDICT_LABELS: VerdictLabel[] = ['GO', 'CONDITIONAL', 'NO-GO', 'INCOMPLETE'];

export function isLayerStatus(x: unknown): x is LayerStatus {
  return typeof x === 'string' && (LAYER_STATUSES as string[]).includes(x);
}

export function isVerdictLabel(x: unknown): x is VerdictLabel {
  return typeof x === 'string' && (VERDICT_LABELS as string[]).includes(x);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/types.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts tests/lib/types.test.ts
git commit -m "Add core domain types (Verdict, Check, FetchedData, fetcher shapes)"
```

---

## Task 2: Port thresholds from reference/thresholds.md

**Files:**
- Create: `src/lib/config/thresholds.ts`
- Test: `tests/lib/config/thresholds.test.ts`

This task hand-ports the numbers from `reference/thresholds.md`. The engineer **must** read that file first and match every number exactly. The drift-detection burden is on whoever edits these later.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/config/thresholds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { thresholds, WARN_BAND } from '../../../src/lib/config/thresholds.js';

describe('thresholds (matches reference/thresholds.md)', () => {
  it('sustained wind during trip ≤ 15 kt', () => {
    expect(thresholds.windSustainedTripKt).toBe(15);
  });
  it('sustained wind at launch ≤ 10 kt', () => {
    expect(thresholds.windSustainedLaunchKt).toBe(10);
  });
  it('wind gust ≤ 15 kt', () => {
    expect(thresholds.windGustKt).toBe(15);
  });
  it('swell height ≤ 5 ft', () => {
    expect(thresholds.swellHeightFt).toBe(5);
  });
  it('swell period ≥ 10 sec', () => {
    expect(thresholds.swellPeriodSec).toBe(10);
  });
  it('wind/swell direction alignment within 45°', () => {
    expect(thresholds.windSwellAlignmentDeg).toBe(45);
  });
  it('visibility ≥ 1 nm', () => {
    expect(thresholds.visibilityNm).toBe(1);
  });
  it('warn band is 20% of fail', () => {
    expect(WARN_BAND).toBe(0.2);
  });
  it('solo outside jetties is permanently no-go in year 1', () => {
    expect(thresholds.soloOutsideJettiesYearOne).toBe('NO-GO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/config/thresholds.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement thresholds**

Create `src/lib/config/thresholds.ts`. Numbers MUST match `reference/thresholds.md` (last updated May 2, 2026 per the file):

```ts
/**
 * Mirror of reference/thresholds.md.
 * Source of truth is the markdown file; this is the runtime copy.
 * When reference/thresholds.md changes, update this file in the same commit.
 */
export const thresholds = {
  // Layer 2 — hard fails (any single = no-go)
  windSustainedLaunchKt: 10,
  windSustainedTripKt: 15,
  windGustKt: 15,
  swellHeightFt: 5,
  swellPeriodSec: 10,
  windSwellAlignmentDeg: 45,
  visibilityNm: 1,
  waterTempLayeringRequiredF: 60, // Tempest required below this; always required in Humboldt

  // Hardcoded year-1 rules
  soloOutsideJettiesYearOne: 'NO-GO' as const,
  humboldtBarCrossing: 'PERMANENTLY-RULED-OUT' as const,
  openOceanLaunchesAllowed: ['trinidad'] as const,

  // Trip duration cap
  yearOneTripDurationHr: 4
};

/**
 * "Warn" band per SKILL.md: any single Layer 2 threshold within 20% of fail.
 * Two or more warns → CONDITIONAL.
 */
export const WARN_BAND = 0.2;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/config/thresholds.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/thresholds.ts tests/lib/config/thresholds.test.ts
git commit -m "Port thresholds from reference/thresholds.md"
```

---

## Task 3: Port launch profile (Trinidad)

**Files:**
- Create: `src/lib/config/launches.ts`
- Test: `tests/lib/config/launches.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/config/launches.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { launches, getLaunch } from '../../../src/lib/config/launches.js';

describe('launches', () => {
  it('trinidad profile is defined', () => {
    const t = getLaunch('trinidad');
    expect(t.id).toBe('trinidad');
    expect(t.label).toBe('Trinidad Harbor');
    expect(t.openOcean).toBe(true);
    expect(t.requiresSwellCheck).toBe(true);
    expect(t.requiresBarCheck).toBe(false); // no bar at Trinidad
    expect(t.coordinates.lat).toBeCloseTo(41.0586, 3);
    expect(t.coordinates.lon).toBeCloseTo(-124.1431, 3);
  });

  it('only trinidad is exposed in v1', () => {
    expect(Object.keys(launches)).toEqual(['trinidad']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/config/launches.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement launches**

Create `src/lib/config/launches.ts`:

```ts
import type { LaunchId } from '../types.js';

export interface LaunchProfile {
  id: LaunchId;
  label: string;
  openOcean: boolean;
  requiresSwellCheck: boolean;
  requiresBarCheck: boolean;
  soloInYearOne: boolean;
  coordinates: { lat: number; lon: number };
  tideStation: string;
  nwsZone: string;
  ndbcBuoyPrimary: string;
  ndbcBuoySecondary?: string;
  notes: string;
}

export const launches: Record<LaunchId, LaunchProfile> = {
  trinidad: {
    id: 'trinidad',
    label: 'Trinidad Harbor',
    openOcean: true,
    requiresSwellCheck: true,
    requiresBarCheck: false,
    soloInYearOne: false, // open Pacific = not solo in year 1
    coordinates: { lat: 41.0586, lon: -124.1431 },
    tideStation: '9418723', // Trinidad Harbor subordinate; falls back to 9418767 if unavailable
    nwsZone: 'PZZ450',
    ndbcBuoyPrimary: '46244',
    ndbcBuoySecondary: '46022',
    notes: 'Only open-Pacific launch per user rule. VHF 78 monitored locally.'
  }
};

export function getLaunch(id: LaunchId): LaunchProfile {
  const l = launches[id];
  if (!l) throw new Error(`Unknown launch: ${id}`);
  return l;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/config/launches.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/launches.ts tests/lib/config/launches.test.ts
git commit -m "Port Trinidad Harbor launch profile"
```

---

## Task 4: Port regulations (rockfish/lingcod, salmon)

**Files:**
- Create: `src/lib/config/regs.ts`
- Test: `tests/lib/config/regs.test.ts`

Engineer must read `reference/regs/rockfish-lingcod-2026-northern.md` and `reference/regs/salmon-2026-kmz.md` before writing this.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/config/regs.test.ts`:

```ts
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
    expect(regs.rockfish.requirements).toContain('descender device');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/config/regs.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement regulations**

Create `src/lib/config/regs.ts`. Verify the dates and windows against the markdown files in `reference/regs/` before committing:

```ts
import type { Species } from '../types.js';

export interface SpeciesRegs {
  label: string;
  seasonWindows: Array<{ start: string; end: string }>; // YYYY-MM-DD inclusive
  requirements: string[];
  hotlinePhone?: string;
  hotlineLabel?: string;
  requiresHotlineVerify: boolean;
}

export const regs: Record<Species, SpeciesRegs> = {
  rockfish: {
    label: 'Rockfish (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License + Ocean Enhancement Stamp',
      'descender device on board',
      '4-vermilion sub-limit (Northern Mgmt Area)'
    ],
    requiresHotlineVerify: false
  },
  lingcod: {
    label: 'Lingcod (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License + Ocean Enhancement Stamp',
      'descender device on board (combined groundfish trips)',
      '22" minimum size, 2 fish daily bag'
    ],
    requiresHotlineVerify: false
  },
  salmon: {
    label: 'Salmon (KMZ — Klamath Management Zone)',
    seasonWindows: [
      { start: '2026-06-13', end: '2026-07-19' },
      { start: '2026-08-01', end: '2026-08-31' }
    ],
    requirements: [
      'CDFW Sport Fishing License + Ocean Enhancement Stamp + Salmon Report Card',
      '20" minimum size (Chinook)',
      'barbless circle hooks when fishing with bait'
    ],
    hotlinePhone: '707-576-3429',
    hotlineLabel: 'CDFW Ocean Salmon Hotline',
    requiresHotlineVerify: true
  }
};

export interface SeasonCheck {
  open: boolean;
  reason?: string;
}

export function isSpeciesOpen(species: Species, dateISO: string): SeasonCheck {
  const r = regs[species];
  const inWindow = r.seasonWindows.some(
    (w) => dateISO >= w.start && dateISO <= w.end
  );
  if (inWindow) return { open: true };
  return {
    open: false,
    reason: `${r.label} closed on ${dateISO}. Open windows: ${r.seasonWindows
      .map((w) => `${w.start} – ${w.end}`)
      .join(', ')}.`
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/config/regs.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/regs.ts tests/lib/config/regs.test.ts
git commit -m "Port rockfish/lingcod and salmon regulations"
```

---

## Task 5: Source URLs and constants

**Files:**
- Create: `src/lib/config/sources.ts`
- Test: `tests/lib/config/sources.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/config/sources.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sources } from '../../../src/lib/config/sources.js';

describe('sources', () => {
  it('uses PZZ450, not PZZ455', () => {
    expect(sources.nwsZone.url).toContain('PZZ450');
    expect(sources.nwsZone.url).not.toContain('PZZ455');
  });

  it('NDBC 46244 is the primary buoy', () => {
    expect(sources.ndbc46244.url).toBe('https://www.ndbc.noaa.gov/data/realtime2/46244.txt');
  });

  it('Tides station is 9418767 (Humboldt Bay North Spit)', () => {
    expect(sources.tides.station).toBe('9418767');
  });

  it('every source has a TTL (seconds) and label', () => {
    for (const s of Object.values(sources)) {
      expect(s.ttlSec).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/config/sources.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement sources**

Create `src/lib/config/sources.ts`:

```ts
export interface SourceDef {
  label: string;
  url: string;
  ttlSec: number;
}

export interface NwsPointSource {
  label: string;
  // NWS requires a two-step flow: /points/{lat,lon} → forecast URL.
  // We hardcode the point endpoint and resolve the forecast URL on first call.
  pointUrl: (lat: number, lon: number) => string;
  ttlSec: number;
}

export interface TidesSourceDef {
  label: string;
  station: string;
  url: (station: string, beginDate: string, endDate: string) => string;
  ttlSec: number;
}

export const sources = {
  ndbc46244: {
    label: 'NDBC 46244 (Humboldt Bay)',
    url: 'https://www.ndbc.noaa.gov/data/realtime2/46244.txt',
    ttlSec: 600 // 10 min
  } as SourceDef,

  ndbc46022: {
    label: 'NDBC 46022 (Eel River)',
    url: 'https://www.ndbc.noaa.gov/data/realtime2/46022.txt',
    ttlSec: 600
  } as SourceDef,

  nwsZone: {
    label: 'NWS Marine PZZ450',
    url: 'https://api.weather.gov/zones/forecast/PZZ450/forecast',
    ttlSec: 3600 // 1 h
  } as SourceDef,

  nwsPoint: {
    label: 'NWS Point Forecast (Trinidad)',
    pointUrl: (lat, lon) => `https://api.weather.gov/points/${lat},${lon}`,
    ttlSec: 3600
  } as NwsPointSource,

  tides: {
    label: 'NOAA Tides 9418767',
    station: '9418767',
    url: (station, beginDate, endDate) =>
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=predictions&application=humboldt.fish&` +
      `begin_date=${beginDate}&end_date=${endDate}&` +
      `datum=MLLW&station=${station}&time_zone=lst_ldt&units=english&` +
      `interval=hilo&format=json`,
    ttlSec: 86400 // 24 h
  } as TidesSourceDef
};

export const USER_AGENT = 'humboldt.fish (https://humboldt.fish)';
```

> **Note for the engineer:** `api.weather.gov` *requires* a User-Agent header identifying the caller. Always set it on every NWS request. NDBC and tidesandcurrents don't strictly require it but it's polite.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/config/sources.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/sources.ts tests/lib/config/sources.test.ts
git commit -m "Define NOAA source URLs, station IDs, and per-source TTLs"
```

---

## Task 6: NDBC buoy fetcher

**Files:**
- Create: `src/lib/fetchers/ndbc.ts`
- Create: `tests/fixtures/ndbc-46244-2026-05-17.txt` (saved real response — see Step 1)
- Create: `tests/fixtures/ndbc-46244-calm.txt` (synthesized calm-day fixture)
- Test: `tests/lib/fetchers/ndbc.test.ts`

NDBC realtime2 is a fixed-width text file with two header rows and observation rows newest-first. Time is UTC.

- [ ] **Step 1: Capture the live fixture**

```bash
mkdir -p tests/fixtures
curl -s "https://www.ndbc.noaa.gov/data/realtime2/46244.txt" | head -30 > tests/fixtures/ndbc-46244-live.txt
```

Then manually craft `tests/fixtures/ndbc-46244-2026-05-17.txt` representing the May 17 dangerous reading:

```
#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC   mi  hPa    ft
2026 05 17 13 50  290  6.2  8.1  3.20  11.0   8.5 295 1015.2  11.5  11.0   9.8   MM   MM   MM
2026 05 17 13 20  285  5.8  7.5  3.18  11.0   8.4 290 1015.3  11.4  11.0   9.7   MM   MM   MM
```

The 3.20 m wave height = 10.5 ft. WDIR 290° = WNW. This is the headline NO-GO case.

Craft `tests/fixtures/ndbc-46244-calm.txt`:

```
#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC   mi  hPa    ft
2026 05 20 14 00  270  3.0  4.0  1.10  12.0   9.0 275 1018.0  12.0  11.5  10.0   MM   MM   MM
```

3.0 m/s = 5.8 kt wind, 1.10 m = 3.6 ft swell, period 12 s — all green.

- [ ] **Step 2: Write the failing test**

Create `tests/lib/fetchers/ndbc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNdbc } from '../../../src/lib/fetchers/ndbc.js';

const may17 = readFileSync(resolve('tests/fixtures/ndbc-46244-2026-05-17.txt'), 'utf-8');
const calm = readFileSync(resolve('tests/fixtures/ndbc-46244-calm.txt'), 'utf-8');

describe('parseNdbc', () => {
  it('parses the May 17 dangerous reading (10.5 ft @ 11s WNW)', () => {
    const obs = parseNdbc(may17);
    expect(obs).not.toBeNull();
    expect(obs!.waveHtFt).toBeCloseTo(10.5, 1);
    expect(obs!.dominantPeriodSec).toBe(11.0);
    expect(obs!.windDirDeg).toBe(290); // WNW
    expect(obs!.meanWaveDirDeg).toBe(295);
  });

  it('parses the calm fixture', () => {
    const obs = parseNdbc(calm);
    expect(obs).not.toBeNull();
    expect(obs!.waveHtFt).toBeCloseTo(3.6, 1);
    expect(obs!.dominantPeriodSec).toBe(12.0);
    expect(obs!.windKt).toBeCloseTo(5.8, 1);
  });

  it('handles MM (missing) values as null', () => {
    const obs = parseNdbc(may17);
    expect(obs!.waterTempF).not.toBeNull(); // 11.0 °C → 51.8 °F
    // visibility column is MM in fixture
  });

  it('returns null for an empty response', () => {
    expect(parseNdbc('')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/lib/fetchers/ndbc.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the NDBC parser and fetcher**

Create `src/lib/fetchers/ndbc.ts`:

```ts
import type { NdbcObservation } from '../types.js';

const MS_PER_KT = 1 / 0.514444; // m/s → kt
const M_PER_FT = 0.3048;

function parseField(s: string): number | null {
  const t = s.trim();
  if (t === 'MM' || t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function cToF(c: number | null): number | null {
  return c === null ? null : c * 9 / 5 + 32;
}

export function parseNdbc(raw: string): NdbcObservation | null {
  const lines = raw.split('\n').filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return null;
  // First non-header line is the newest observation.
  const cols = lines[0].trim().split(/\s+/);
  if (cols.length < 15) return null;
  const [yr, mo, dy, hr, mn] = cols.slice(0, 5);
  const wdir = parseField(cols[5]);
  const wspdMs = parseField(cols[6]);
  const gstMs = parseField(cols[7]);
  const wvhtM = parseField(cols[8]);
  const dpd = parseField(cols[9]);
  // cols[10] is APD (average period) — unused
  const mwd = parseField(cols[11]);
  const wtmpC = parseField(cols[14]);

  const observedAt = `${yr}-${mo}-${dy}T${hr}:${mn}:00Z`;

  return {
    observedAt,
    windKt: wspdMs === null ? null : wspdMs * MS_PER_KT,
    gustKt: gstMs === null ? null : gstMs * MS_PER_KT,
    windDirDeg: wdir,
    waveHtFt: wvhtM === null ? null : wvhtM / M_PER_FT,
    dominantPeriodSec: dpd,
    meanWaveDirDeg: mwd,
    waterTempF: cToF(wtmpC)
  };
}

export interface FetchResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  fetchedAt: string;
}

export async function fetchNdbc(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<NdbcObservation>> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'humboldt.fish' } });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    }
    const text = await res.text();
    const parsed = parseNdbc(text);
    if (!parsed) {
      return { ok: false, error: 'NDBC response had no data rows', fetchedAt };
    }
    return { ok: true, data: parsed, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/lib/fetchers/ndbc.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fetchers/ndbc.ts tests/lib/fetchers/ndbc.test.ts tests/fixtures/ndbc-*.txt
git commit -m "Add NDBC realtime2 parser + fetcher with May 17 fixture"
```

---

## Task 7: NWS marine zone forecast fetcher

**Files:**
- Create: `src/lib/fetchers/nws-zone.ts`
- Create: `tests/fixtures/nws-pzz450.json` (live capture, sanitized)
- Test: `tests/lib/fetchers/nws-zone.test.ts`

- [ ] **Step 1: Capture the fixture**

```bash
curl -s -H 'User-Agent: humboldt.fish' \
  "https://api.weather.gov/zones/forecast/PZZ450/forecast" \
  > tests/fixtures/nws-pzz450.json
```

Inspect the response — it should have `properties.periods[]` with `number`, `name`, `startTime`, `endTime`, `detailedForecast`.

- [ ] **Step 2: Write the failing test**

Create `tests/lib/fetchers/nws-zone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNwsZone } from '../../../src/lib/fetchers/nws-zone.js';

const fixture = readFileSync(resolve('tests/fixtures/nws-pzz450.json'), 'utf-8');

describe('parseNwsZone', () => {
  it('extracts zone code, updated time, and periods', () => {
    const parsed = parseNwsZone(JSON.parse(fixture));
    expect(parsed.zone).toBe('PZZ450');
    expect(parsed.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.periods.length).toBeGreaterThan(0);
    const p0 = parsed.periods[0];
    expect(typeof p0.detailedForecast).toBe('string');
    expect(p0.detailedForecast.length).toBeGreaterThan(0);
  });

  it('rejects payload that fails schema', () => {
    expect(() => parseNwsZone({ properties: {} })).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/lib/fetchers/nws-zone.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the NWS zone parser and fetcher**

Create `src/lib/fetchers/nws-zone.ts`:

```ts
import { z } from 'zod';
import type { NwsZoneForecast } from '../types.js';
import type { FetchResult } from './ndbc.js';

const ZoneSchema = z.object({
  properties: z.object({
    zone: z.string(),
    updated: z.string(),
    periods: z.array(
      z.object({
        number: z.number(),
        name: z.string(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        detailedForecast: z.string()
      })
    ).min(1)
  })
});

export function parseNwsZone(raw: unknown): NwsZoneForecast {
  const v = ZoneSchema.parse(raw);
  // The "zone" property in the response is a URL like ".../zones/forecast/PZZ450".
  // Extract the zone code.
  const match = v.properties.zone.match(/PZZ\d{3}/);
  const zone = match ? match[0] : v.properties.zone;
  return {
    zone,
    updated: v.properties.updated,
    periods: v.properties.periods.map((p) => ({
      number: p.number,
      name: p.name,
      startTime: p.startTime ?? '',
      endTime: p.endTime ?? '',
      detailedForecast: p.detailedForecast
    }))
  };
}

export async function fetchNwsZone(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<NwsZoneForecast>> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': 'humboldt.fish (https://humboldt.fish)',
        Accept: 'application/geo+json'
      }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    const json = await res.json();
    return { ok: true, data: parseNwsZone(json), fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/lib/fetchers/nws-zone.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fetchers/nws-zone.ts tests/lib/fetchers/nws-zone.test.ts tests/fixtures/nws-pzz450.json
git commit -m "Add NWS marine zone (PZZ450) fetcher with Zod schema"
```

---

## Task 8: NWS point forecast fetcher (Trinidad)

**Files:**
- Create: `src/lib/fetchers/nws-point.ts`
- Create: `tests/fixtures/nws-point-meta.json`, `tests/fixtures/nws-point-forecast.json`
- Test: `tests/lib/fetchers/nws-point.test.ts`

NWS point forecasts require a two-step flow: GET `/points/{lat,lon}` → response has a `properties.forecast` URL → GET that URL.

- [ ] **Step 1: Capture fixtures**

```bash
curl -s -H 'User-Agent: humboldt.fish' \
  "https://api.weather.gov/points/41.0586,-124.1431" \
  > tests/fixtures/nws-point-meta.json

# Extract forecast URL from the meta response, then:
FORECAST_URL=$(jq -r .properties.forecast tests/fixtures/nws-point-meta.json)
curl -s -H 'User-Agent: humboldt.fish' "$FORECAST_URL" \
  > tests/fixtures/nws-point-forecast.json
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/fetchers/nws-point.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNwsPointMeta, parseNwsPointForecast } from '../../../src/lib/fetchers/nws-point.js';

const meta = readFileSync(resolve('tests/fixtures/nws-point-meta.json'), 'utf-8');
const fc = readFileSync(resolve('tests/fixtures/nws-point-forecast.json'), 'utf-8');

describe('parseNwsPointMeta', () => {
  it('extracts the forecast URL', () => {
    const m = parseNwsPointMeta(JSON.parse(meta));
    expect(m.forecastUrl).toMatch(/^https:\/\/api\.weather\.gov\/gridpoints\//);
  });
});

describe('parseNwsPointForecast', () => {
  it('extracts periods with wind speed strings and isDaytime', () => {
    const f = parseNwsPointForecast(JSON.parse(fc));
    expect(f.periods.length).toBeGreaterThan(0);
    expect(typeof f.periods[0].windSpeed).toBe('string');
    expect(typeof f.periods[0].isDaytime).toBe('boolean');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/lib/fetchers/nws-point.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement parsers and fetcher**

Create `src/lib/fetchers/nws-point.ts`:

```ts
import { z } from 'zod';
import type { NwsPointForecast } from '../types.js';
import type { FetchResult } from './ndbc.js';

const PointMetaSchema = z.object({
  properties: z.object({
    forecast: z.string().url(),
    forecastHourly: z.string().url().optional()
  })
});

const PointForecastSchema = z.object({
  properties: z.object({
    updated: z.string(),
    periods: z.array(
      z.object({
        number: z.number(),
        name: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        isDaytime: z.boolean(),
        temperature: z.number(),
        windSpeed: z.string(),
        windDirection: z.string(),
        shortForecast: z.string(),
        detailedForecast: z.string()
      })
    )
  })
});

export function parseNwsPointMeta(raw: unknown): { forecastUrl: string } {
  const v = PointMetaSchema.parse(raw);
  return { forecastUrl: v.properties.forecast };
}

export function parseNwsPointForecast(raw: unknown): NwsPointForecast {
  const v = PointForecastSchema.parse(raw);
  return v.properties;
}

const HEADERS = {
  'User-Agent': 'humboldt.fish (https://humboldt.fish)',
  Accept: 'application/geo+json'
};

export async function fetchNwsPoint(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<NwsPointForecast>> {
  const fetchedAt = new Date().toISOString();
  try {
    const metaRes = await fetchImpl(`https://api.weather.gov/points/${lat},${lon}`, { headers: HEADERS });
    if (!metaRes.ok) return { ok: false, error: `points HTTP ${metaRes.status}`, fetchedAt };
    const meta = parseNwsPointMeta(await metaRes.json());

    const fcRes = await fetchImpl(meta.forecastUrl, { headers: HEADERS });
    if (!fcRes.ok) return { ok: false, error: `forecast HTTP ${fcRes.status}`, fetchedAt };
    const data = parseNwsPointForecast(await fcRes.json());
    return { ok: true, data, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/lib/fetchers/nws-point.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fetchers/nws-point.ts tests/lib/fetchers/nws-point.test.ts tests/fixtures/nws-point-*.json
git commit -m "Add NWS point forecast fetcher (two-step meta + forecast)"
```

---

## Task 9: Tides fetcher

**Files:**
- Create: `src/lib/fetchers/tides.ts`
- Create: `tests/fixtures/tides-9418767.json`
- Test: `tests/lib/fetchers/tides.test.ts`

- [ ] **Step 1: Capture the fixture**

```bash
curl -s "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=humboldt.fish&begin_date=20260517&end_date=20260524&datum=MLLW&station=9418767&time_zone=lst_ldt&units=english&interval=hilo&format=json" \
  > tests/fixtures/tides-9418767.json
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/fetchers/tides.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTides } from '../../../src/lib/fetchers/tides.js';

const fixture = readFileSync(resolve('tests/fixtures/tides-9418767.json'), 'utf-8');

describe('parseTides', () => {
  it('parses hi/lo events with time, height, and type', () => {
    const t = parseTides(JSON.parse(fixture), '9418767');
    expect(t.station).toBe('9418767');
    expect(t.events.length).toBeGreaterThan(0);
    expect(['H', 'L']).toContain(t.events[0].type);
    expect(typeof t.events[0].height).toBe('number');
  });

  it('throws on unexpected payload', () => {
    expect(() => parseTides({}, '9418767')).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/lib/fetchers/tides.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement tides parser and fetcher**

Create `src/lib/fetchers/tides.ts`:

```ts
import { z } from 'zod';
import type { TidePredictions } from '../types.js';
import type { FetchResult } from './ndbc.js';

const TidesSchema = z.object({
  predictions: z.array(
    z.object({
      t: z.string(),    // "2026-05-17 04:32"
      v: z.string(),    // height as string, e.g. "5.21"
      type: z.enum(['H', 'L'])
    })
  )
});

export function parseTides(raw: unknown, station: string): TidePredictions {
  const v = TidesSchema.parse(raw);
  return {
    station,
    events: v.predictions.map((p) => ({
      time: p.t.replace(' ', 'T'), // local LST/LDT; we render directly without TZ conversion
      height: Number(p.v),
      type: p.type
    }))
  };
}

export async function fetchTides(
  url: string,
  station: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<TidePredictions>> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'humboldt.fish' } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    const json = await res.json();
    return { ok: true, data: parseTides(json, station), fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}

/** Format YYYY-MM-DD into the YYYYMMDD shape the API wants. */
export function toApiDate(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/lib/fetchers/tides.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fetchers/tides.ts tests/lib/fetchers/tides.test.ts tests/fixtures/tides-9418767.json
git commit -m "Add NOAA tides fetcher with hi/lo prediction parsing"
```

---

## Task 10: Sun times (local compute via suncalc)

**Files:**
- Create: `src/lib/fetchers/suntimes.ts`
- Test: `tests/lib/fetchers/suntimes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/fetchers/suntimes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSunTimes } from '../../../src/lib/fetchers/suntimes.js';

describe('computeSunTimes (Trinidad ~41.06°N, -124.14°W)', () => {
  it('returns civilDawn/sunrise/sunset/civilDusk ISO strings for each date', () => {
    const dates = ['2026-05-17', '2026-05-18', '2026-05-19'];
    const out = computeSunTimes(dates, 41.0586, -124.1431);
    for (const d of dates) {
      expect(out.byDate[d]).toBeDefined();
      expect(out.byDate[d].sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(out.byDate[d].sunset).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Civil dawn is earlier than sunrise
      expect(out.byDate[d].civilDawn < out.byDate[d].sunrise).toBe(true);
      // Sunset is earlier than civil dusk
      expect(out.byDate[d].sunset < out.byDate[d].civilDusk).toBe(true);
    }
  });

  it('May Trinidad sunrise is roughly 06:00 PDT (13:00 UTC ± 1h)', () => {
    const out = computeSunTimes(['2026-05-17'], 41.0586, -124.1431);
    const sr = new Date(out.byDate['2026-05-17'].sunrise);
    expect(sr.getUTCHours()).toBeGreaterThanOrEqual(12);
    expect(sr.getUTCHours()).toBeLessThanOrEqual(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/fetchers/suntimes.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement sun times**

Create `src/lib/fetchers/suntimes.ts`:

```ts
import SunCalc from 'suncalc';
import type { SunTimes } from '../types.js';

export function computeSunTimes(dates: string[], lat: number, lon: number): SunTimes {
  const byDate: SunTimes['byDate'] = {};
  for (const d of dates) {
    // SunCalc takes a Date; use noon UTC of the target day to avoid TZ flipping.
    const noon = new Date(`${d}T20:00:00Z`); // 20:00 UTC ≈ midday PDT
    const t = SunCalc.getTimes(noon, lat, lon);
    byDate[d] = {
      civilDawn: t.dawn.toISOString(),
      sunrise: t.sunrise.toISOString(),
      sunset: t.sunset.toISOString(),
      civilDusk: t.dusk.toISOString()
    };
  }
  return { byDate };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/fetchers/suntimes.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/suntimes.ts tests/lib/fetchers/suntimes.test.ts
git commit -m "Add local sun/civil twilight compute via suncalc"
```

---

## Task 11: Cache wrapper for Cloudflare Cache API

**Files:**
- Create: `src/lib/fetchers/cache.ts`
- Test: `tests/lib/fetchers/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/fetchers/cache.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { cachedFetch } from '../../../src/lib/fetchers/cache.js';

function mkResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

describe('cachedFetch', () => {
  it('returns response from network and writes to cache on first call', async () => {
    const cacheGet = vi.fn().mockResolvedValue(undefined);
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheMock = { match: cacheGet, put: cachePut } as unknown as Cache;
    const fetchMock = vi.fn().mockResolvedValue(mkResponse('hello'));
    const res = await cachedFetch('https://example.com', { ttlSec: 60 }, fetchMock, cacheMock);
    expect(await res.text()).toBe('hello');
    expect(cacheGet).toHaveBeenCalledOnce();
    expect(cachePut).toHaveBeenCalledOnce();
  });

  it('returns cached response without calling fetch when cache hits', async () => {
    const cached = mkResponse('cached!');
    const cacheGet = vi.fn().mockResolvedValue(cached);
    const cachePut = vi.fn();
    const cacheMock = { match: cacheGet, put: cachePut } as unknown as Cache;
    const fetchMock = vi.fn();
    const res = await cachedFetch('https://example.com', { ttlSec: 60 }, fetchMock, cacheMock);
    expect(await res.text()).toBe('cached!');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bypasses cache when bypass=true', async () => {
    const cached = mkResponse('cached!');
    const cacheGet = vi.fn().mockResolvedValue(cached);
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheMock = { match: cacheGet, put: cachePut } as unknown as Cache;
    const fetchMock = vi.fn().mockResolvedValue(mkResponse('fresh!'));
    const res = await cachedFetch(
      'https://example.com',
      { ttlSec: 60, bypass: true },
      fetchMock,
      cacheMock
    );
    expect(await res.text()).toBe('fresh!');
    expect(cacheGet).not.toHaveBeenCalled();
    expect(cachePut).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/fetchers/cache.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement cache wrapper**

Create `src/lib/fetchers/cache.ts`:

```ts
export interface CacheOptions {
  ttlSec: number;
  bypass?: boolean;
  init?: RequestInit;
}

/**
 * Cloudflare-style cached fetch.
 *
 * In production, pass `caches.default` for the cache argument.
 * The cache is keyed by the URL string. Responses are cloned with a
 * Cache-Control header reflecting the TTL.
 *
 * When `bypass: true`, the cache is skipped on read but still written.
 */
export async function cachedFetch(
  url: string,
  opts: CacheOptions,
  fetchImpl: typeof fetch = fetch,
  cache?: Cache
): Promise<Response> {
  const key = new Request(url, { method: 'GET' });
  if (cache && !opts.bypass) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await fetchImpl(url, opts.init);
  if (cache && res.ok) {
    const cacheable = new Response(res.clone().body, {
      status: res.status,
      headers: { ...Object.fromEntries(res.headers), 'Cache-Control': `public, max-age=${opts.ttlSec}` }
    });
    await cache.put(key, cacheable);
  }
  return res;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/fetchers/cache.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/cache.ts tests/lib/fetchers/cache.test.ts
git commit -m "Add Cloudflare Cache API wrapper for per-source TTLs"
```

---

## Task 12: Layer 1 — Legal check

**Files:**
- Create: `src/lib/verdict/runLegal.ts`
- Test: `tests/lib/verdict/runLegal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/verdict/runLegal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runLegal } from '../../../src/lib/verdict/runLegal.js';

describe('runLegal', () => {
  it('rockfish open 2026-05-18 → pass', () => {
    const r = runLegal({ species: 'rockfish', date: '2026-05-18' });
    expect(r.result.status).toBe('pass');
    expect(r.checks.find((c) => c.name === 'Season')?.status).toBe('pass');
  });

  it('rockfish closed 2026-01-15 → fail', () => {
    const r = runLegal({ species: 'rockfish', date: '2026-01-15' });
    expect(r.result.status).toBe('fail');
  });

  it('salmon between Jul 19 and Aug 1 → fail (closed)', () => {
    const r = runLegal({ species: 'salmon', date: '2026-07-25' });
    expect(r.result.status).toBe('fail');
  });

  it('salmon during open window adds a hotline-required warn', () => {
    const r = runLegal({ species: 'salmon', date: '2026-06-20' });
    expect(r.result.status).toBe('pass'); // legal layer passes; hotline reminder is a separate Check entry
    const hotline = r.checks.find((c) => c.name === 'Salmon hotline verify');
    expect(hotline).toBeDefined();
    expect(hotline!.note).toContain('707-576-3429');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/verdict/runLegal.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement runLegal**

Create `src/lib/verdict/runLegal.ts`:

```ts
import type { Species, LayerResult, Check } from '../types.js';
import { isSpeciesOpen, regs } from '../config/regs.js';

export interface LegalInput {
  species: Species;
  date: string;
}

export interface LayerOutput {
  result: LayerResult;
  checks: Check[];
}

export function runLegal({ species, date }: LegalInput): LayerOutput {
  const checks: Check[] = [];
  const r = regs[species];
  const season = isSpeciesOpen(species, date);
  checks.push({
    layer: 'legal',
    name: 'Season',
    value: season.open ? 'open' : 'closed',
    threshold: r.seasonWindows.map((w) => `${w.start}–${w.end}`).join(', '),
    status: season.open ? 'pass' : 'fail',
    note: season.reason
  });

  if (r.requiresHotlineVerify && r.hotlinePhone && season.open) {
    checks.push({
      layer: 'legal',
      name: 'Salmon hotline verify',
      value: 'required',
      threshold: 'call within 2h of launch',
      status: 'pass', // present but informational — verdict copy will surface it loudly
      note: `${r.hotlineLabel}: ${r.hotlinePhone}`
    });
  }

  const failed = checks.some((c) => c.status === 'fail');
  return {
    result: {
      status: failed ? 'fail' : 'pass',
      summary: failed
        ? `${r.label} not in season on ${date}`
        : `${r.label} in season`
    },
    checks
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/verdict/runLegal.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict/runLegal.ts tests/lib/verdict/runLegal.test.ts
git commit -m "Layer 1 (Legal): season + hotline checks per species"
```

---

## Task 13: Layer 2 — Safety check (the headline logic)

**Files:**
- Create: `src/lib/verdict/runSafety.ts`
- Test: `tests/lib/verdict/runSafety.test.ts`

This task is the heart of the value prop. Engineer must read `reference/thresholds.md` cover to cover and mirror the SKILL.md fail-stop logic exactly.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/verdict/runSafety.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runSafety } from '../../../src/lib/verdict/runSafety.js';
import type { FetchedData } from '../../../src/lib/types.js';

function baseData(overrides: Partial<FetchedData> = {}): FetchedData {
  return {
    ndbc46244: {
      observedAt: '2026-05-17T14:00:00Z',
      windKt: 6, gustKt: 8, windDirDeg: 270,
      waveHtFt: 3.5, dominantPeriodSec: 12, meanWaveDirDeg: 275,
      waterTempF: 52
    },
    ndbc46022: null,
    nwsZone: {
      zone: 'PZZ450',
      updated: '2026-05-17T10:00:00Z',
      periods: [
        {
          number: 1, name: 'Today', startTime: '2026-05-17T12:00:00Z', endTime: '2026-05-18T00:00:00Z',
          detailedForecast: 'NW wind 5 to 10 kt. Wind waves 1 to 2 ft. NW swell 4 ft at 12 seconds.'
        }
      ]
    },
    nwsPoint: null,
    tides: null,
    suntimes: { byDate: {} },
    ...overrides
  };
}

describe('runSafety', () => {
  it('all-green calm-day data → pass', () => {
    const r = runSafety({ date: '2026-05-17', data: baseData() });
    expect(r.result.status).toBe('pass');
  });

  it('THE MAY 17 CASE: buoy 10.5 ft @ 11s WNW → fail (swell)', () => {
    const r = runSafety({
      date: '2026-05-17',
      data: baseData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 12, gustKt: 16, windDirDeg: 290,
          waveHtFt: 10.5, dominantPeriodSec: 11, meanWaveDirDeg: 295,
          waterTempF: 51.8
        }
      })
    });
    expect(r.result.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Swell height')?.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Wind gust')?.status).toBe('fail');
  });

  it('sustained wind 16 kt → fail (over 15 kt trip threshold)', () => {
    const r = runSafety({
      date: '2026-05-17',
      data: baseData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 16, gustKt: 18, windDirDeg: 270,
          waveHtFt: 3, dominantPeriodSec: 12, meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
  });

  it('swell period 9 sec → fail (under 10 sec threshold)', () => {
    const r = runSafety({
      date: '2026-05-17',
      data: baseData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 6, gustKt: 8, windDirDeg: 270,
          waveHtFt: 3.5, dominantPeriodSec: 9, meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
  });

  it('wind 13 kt (within 20% of 15 kt fail) → warn', () => {
    const r = runSafety({
      date: '2026-05-17',
      data: baseData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 13, gustKt: 14, windDirDeg: 270,
          waveHtFt: 3, dominantPeriodSec: 12, meanWaveDirDeg: 275,
          waterTempF: 52
        }
      })
    });
    const wind = r.checks.find((c) => c.name === 'Sustained wind');
    expect(wind?.status).toBe('warn');
  });

  it('opposing wind/swell (>45° apart) → fail', () => {
    const r = runSafety({
      date: '2026-05-17',
      data: baseData({
        ndbc46244: {
          observedAt: '2026-05-17T14:00:00Z',
          windKt: 8, gustKt: 10, windDirDeg: 90,    // E
          waveHtFt: 3, dominantPeriodSec: 12, meanWaveDirDeg: 270, // W
          waterTempF: 52
        }
      })
    });
    expect(r.result.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Wind/swell alignment')?.status).toBe('fail');
  });

  it('missing buoy data → incomplete (not pass, not fail)', () => {
    const r = runSafety({
      date: '2026-05-17',
      data: baseData({ ndbc46244: null })
    });
    expect(r.result.status).toBe('incomplete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/verdict/runSafety.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement runSafety**

Create `src/lib/verdict/runSafety.ts`:

```ts
import type { FetchedData, LayerResult, Check, CheckStatus } from '../types.js';
import { thresholds, WARN_BAND } from '../config/thresholds.js';

export interface SafetyInput {
  date: string;
  data: FetchedData;
}

export interface SafetyOutput {
  result: LayerResult;
  checks: Check[];
}

/** Status helper: above fail → fail. Within WARN_BAND of fail → warn. Else pass. */
function evalAbove(value: number, failAt: number): CheckStatus {
  if (value > failAt) return 'fail';
  if (value >= failAt * (1 - WARN_BAND)) return 'warn';
  return 'pass';
}

/** Status helper for thresholds that should be at-least (e.g. swell period ≥10s). */
function evalAtLeast(value: number, failBelow: number): CheckStatus {
  if (value < failBelow) return 'fail';
  if (value <= failBelow * (1 + WARN_BAND)) return 'warn';
  return 'pass';
}

function angularDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function runSafety({ date, data }: SafetyInput): SafetyOutput {
  const checks: Check[] = [];
  const buoy = data.ndbc46244;

  if (!buoy) {
    return {
      result: { status: 'incomplete', summary: 'Buoy 46244 unavailable' },
      checks: [
        {
          layer: 'safety', name: 'Buoy 46244', value: 'unavailable',
          threshold: 'required for live signal', status: 'unknown',
          note: 'Cannot evaluate safety without observed conditions.'
        }
      ]
    };
  }

  // Sustained wind (during trip window — use buoy as proxy for now; v2 can layer forecast)
  if (buoy.windKt !== null) {
    const s = evalAbove(buoy.windKt, thresholds.windSustainedTripKt);
    checks.push({
      layer: 'safety', name: 'Sustained wind',
      value: `${buoy.windKt.toFixed(1)} kt`,
      threshold: `≤ ${thresholds.windSustainedTripKt} kt`,
      status: s
    });
  }
  // Wind gust
  if (buoy.gustKt !== null) {
    const s = evalAbove(buoy.gustKt, thresholds.windGustKt);
    checks.push({
      layer: 'safety', name: 'Wind gust',
      value: `${buoy.gustKt.toFixed(1)} kt`,
      threshold: `≤ ${thresholds.windGustKt} kt`,
      status: s
    });
  }
  // Swell height
  if (buoy.waveHtFt !== null) {
    const s = evalAbove(buoy.waveHtFt, thresholds.swellHeightFt);
    checks.push({
      layer: 'safety', name: 'Swell height',
      value: `${buoy.waveHtFt.toFixed(1)} ft`,
      threshold: `≤ ${thresholds.swellHeightFt} ft`,
      status: s
    });
  }
  // Swell period
  if (buoy.dominantPeriodSec !== null) {
    const s = evalAtLeast(buoy.dominantPeriodSec, thresholds.swellPeriodSec);
    checks.push({
      layer: 'safety', name: 'Swell period',
      value: `${buoy.dominantPeriodSec.toFixed(1)} s`,
      threshold: `≥ ${thresholds.swellPeriodSec} s`,
      status: s
    });
  }
  // Wind/swell alignment
  if (buoy.windDirDeg !== null && buoy.meanWaveDirDeg !== null) {
    const diff = angularDiffDeg(buoy.windDirDeg, buoy.meanWaveDirDeg);
    const s: CheckStatus = diff > thresholds.windSwellAlignmentDeg
      ? 'fail'
      : diff > thresholds.windSwellAlignmentDeg * (1 - WARN_BAND)
        ? 'warn'
        : 'pass';
    checks.push({
      layer: 'safety', name: 'Wind/swell alignment',
      value: `${diff.toFixed(0)}°`,
      threshold: `≤ ${thresholds.windSwellAlignmentDeg}° apart`,
      status: s
    });
  }
  // Water temp — informational; layering is always required in Humboldt regardless
  if (buoy.waterTempF !== null) {
    checks.push({
      layer: 'safety', name: 'Water temp',
      value: `${buoy.waterTempF.toFixed(1)} °F`,
      threshold: `semi-dry layering required (always in Humboldt)`,
      status: 'pass',
      note: 'Always required regardless of temp.'
    });
  }

  const fails = checks.filter((c) => c.status === 'fail');
  const warns = checks.filter((c) => c.status === 'warn');

  if (fails.length > 0) {
    return {
      result: { status: 'fail', summary: fails.map((c) => `${c.name} ${c.value}`).join(', ') },
      checks
    };
  }
  if (warns.length >= 1) {
    return {
      result: { status: 'warn', summary: warns.map((c) => `${c.name} ${c.value}`).join(', ') },
      checks
    };
  }
  return { result: { status: 'pass', summary: 'All thresholds met' }, checks };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/verdict/runSafety.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict/runSafety.ts tests/lib/verdict/runSafety.test.ts
git commit -m "Layer 2 (Safety): the headline thresholds incl. May 17 case"
```

---

## Task 14: Layer 3 — Quality check

**Files:**
- Create: `src/lib/verdict/runQuality.ts`
- Test: `tests/lib/verdict/runQuality.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/verdict/runQuality.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runQuality } from '../../../src/lib/verdict/runQuality.js';
import type { FetchedData, Species } from '../../../src/lib/types.js';

function baseData(): FetchedData {
  return {
    ndbc46244: null,
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: null,
    tides: {
      station: '9418767',
      events: [
        { time: '2026-05-18T04:32:00', height: -0.5, type: 'L' },
        { time: '2026-05-18T11:05:00', height: 5.8, type: 'H' },
        { time: '2026-05-18T17:42:00', height: 1.2, type: 'L' },
        { time: '2026-05-18T23:51:00', height: 4.9, type: 'H' }
      ]
    },
    suntimes: {
      byDate: {
        '2026-05-18': {
          civilDawn: '2026-05-18T12:30:00Z',
          sunrise: '2026-05-18T13:05:00Z',
          sunset: '2026-05-19T03:30:00Z',
          civilDusk: '2026-05-19T04:00:00Z'
        }
      }
    }
  };
}

describe('runQuality', () => {
  it('returns pass with morning slack time noted', () => {
    const r = runQuality({ species: 'rockfish', date: '2026-05-18', data: baseData() });
    expect(['pass', 'warn']).toContain(r.result.status);
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack).toBeDefined();
  });

  it('salmon target ignores tide stage (trolling tide-agnostic)', () => {
    const r = runQuality({ species: 'salmon', date: '2026-05-18', data: baseData() });
    expect(r.result.status).toBe('pass');
    const slack = r.checks.find((c) => c.name === 'Morning slack');
    expect(slack?.note).toContain('Salmon trolling');
  });

  it('missing tide data → incomplete with note', () => {
    const data = baseData();
    data.tides = null;
    const r = runQuality({ species: 'rockfish', date: '2026-05-18', data });
    expect(r.result.status).toBe('incomplete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/verdict/runQuality.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement runQuality**

Create `src/lib/verdict/runQuality.ts`:

```ts
import type { FetchedData, LayerResult, Check, Species } from '../types.js';

export interface QualityInput {
  species: Species;
  date: string;
  data: FetchedData;
}

export interface QualityOutput {
  result: LayerResult;
  checks: Check[];
}

/**
 * Find the first morning slack (between civil dawn and ~10:00 local).
 * Slack ≈ 30 min before/after a high or low tide event.
 * Returns the H/L event time string if found.
 */
function findMorningSlack(tideEvents: Array<{ time: string; type: 'H' | 'L' }>, date: string): string | undefined {
  // Tide times come back as "YYYY-MM-DDTHH:MM:SS" in local time (LST/LDT). We treat as opaque strings.
  const morningWindow = tideEvents.filter((e) => {
    const [d, t] = e.time.split('T');
    if (d !== date) return false;
    const hr = Number(t.slice(0, 2));
    return hr >= 4 && hr <= 10;
  });
  return morningWindow[0]?.time;
}

export function runQuality({ species, date, data }: QualityInput): QualityOutput {
  const checks: Check[] = [];

  if (!data.tides) {
    return {
      result: { status: 'incomplete', summary: 'Tide data unavailable' },
      checks: [
        {
          layer: 'quality', name: 'Tide stage',
          value: 'unavailable', threshold: 'morning slack preferred',
          status: 'unknown'
        }
      ]
    };
  }

  const slack = findMorningSlack(data.tides.events, date);
  const slackNote =
    species === 'salmon'
      ? 'Salmon trolling is tide-agnostic; informational only.'
      : 'Rockfish/lingcod prefer slack-to-flooding transition.';

  checks.push({
    layer: 'quality', name: 'Morning slack',
    value: slack ? slack.slice(11, 16) : 'none in 04:00–10:00',
    threshold: 'morning slack preferred',
    status: 'pass',
    note: slackNote
  });

  const sun = data.suntimes.byDate[date];
  if (sun) {
    checks.push({
      layer: 'quality', name: 'Daylight window',
      value: `${sun.sunrise.slice(11, 16)}Z – ${sun.sunset.slice(11, 16)}Z`,
      threshold: '—',
      status: 'pass',
      note: `Civil dawn ${sun.civilDawn.slice(11, 16)}Z, civil dusk ${sun.civilDusk.slice(11, 16)}Z`
    });
  }

  return { result: { status: 'pass', summary: 'Quality acceptable' }, checks };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/verdict/runQuality.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict/runQuality.ts tests/lib/verdict/runQuality.test.ts
git commit -m "Layer 3 (Quality): morning slack + daylight window"
```

---

## Task 15: Layer 4 — Logistics check

**Files:**
- Create: `src/lib/verdict/runLogistics.ts`
- Test: `tests/lib/verdict/runLogistics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/verdict/runLogistics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runLogistics } from '../../../src/lib/verdict/runLogistics.js';
import type { FetchedData } from '../../../src/lib/types.js';

function data(): FetchedData {
  return {
    ndbc46244: null, ndbc46022: null, nwsZone: null, nwsPoint: null, tides: null,
    suntimes: {
      byDate: {
        '2026-05-18': {
          civilDawn: '2026-05-18T12:30:00Z',
          sunrise: '2026-05-18T13:05:00Z',
          sunset: '2026-05-19T03:30:00Z',
          civilDusk: '2026-05-19T04:00:00Z'
        }
      }
    }
  };
}

describe('runLogistics', () => {
  it('returns Trinidad launch + gear list', () => {
    const r = runLogistics({ species: 'rockfish', date: '2026-05-18', launch: 'trinidad', data: data() });
    expect(r.result.status).toBe('pass');
    expect(r.recommendations.gear?.length).toBeGreaterThan(0);
    expect(r.recommendations.window).toBeDefined();
  });

  it('salmon recommendation includes hotline gear reminder', () => {
    const r = runLogistics({ species: 'salmon', date: '2026-06-20', launch: 'trinidad', data: data() });
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('descender'))).toBe(false);
    expect(r.recommendations.gear?.some((g) => g.toLowerCase().includes('barbless'))).toBe(true);
  });

  it('surfaces the solo-outside-jetties restriction as an informational check', () => {
    const r = runLogistics({ species: 'rockfish', date: '2026-05-18', launch: 'trinidad', data: data() });
    const solo = r.checks.find((c) => c.name === 'Solo restriction');
    expect(solo).toBeDefined();
    expect(solo!.note).toMatch(/solo/i);
    expect(solo!.note).toMatch(/accompanied/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/verdict/runLogistics.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement runLogistics**

Create `src/lib/verdict/runLogistics.ts`:

```ts
import type { FetchedData, LayerResult, Check, Species, LaunchId, Recommendations } from '../types.js';
import { getLaunch } from '../config/launches.js';

export interface LogisticsInput {
  species: Species;
  date: string;
  launch: LaunchId;
  data: FetchedData;
}

export interface LogisticsOutput {
  result: LayerResult;
  checks: Check[];
  recommendations: Recommendations;
}

const BASE_GEAR = [
  'PFD (worn at all times)',
  'semi-dry paddling top + dry pants + 3mm long john',
  'Neoprene gloves + booties + beanie',
  'VHF on, Channel 16 monitored; bar reports on Ch 22A, Trinidad local Ch 78',
  'Phone in waterproof case, accessible',
  'Float plan filed with shore contact'
];

const SPECIES_GEAR: Record<Species, string[]> = {
  rockfish: ['Descender device rigged and accessible', 'Jigging rods + leadhead/swimbait selection'],
  lingcod: ['Descender device rigged and accessible', 'Swimbait or live-bait setup'],
  salmon: ['Barbless circle hooks (bait)', 'Salmon Report Card on board']
};

export function runLogistics({ species, date, launch, data }: LogisticsInput): LogisticsOutput {
  const launchProfile = getLaunch(launch);
  const sun = data.suntimes.byDate[date];

  const checks: Check[] = [
    {
      layer: 'logistics',
      name: 'Launch',
      value: launchProfile.label,
      threshold: 'open-Pacific launches: Trinidad only',
      status: 'pass'
    },
    {
      layer: 'logistics',
      name: 'Solo restriction',
      value: 'assumes accompanied trip',
      threshold: 'Trinidad outside breakwater: not solo (year 1)',
      status: 'pass',
      note: 'Solo trips outside Trinidad breakwater are NO-GO until ocean experience grows. This verdict assumes a companion is on the water. If launching solo, treat as NO-GO regardless of other indicators.'
    }
  ];

  let window: string | undefined;
  if (sun) {
    // Suggest launch ~30 min after civil dawn, 4-hour trip cap per year-1 rules.
    const dawn = new Date(sun.civilDawn);
    const launchTime = new Date(dawn.getTime() + 30 * 60 * 1000);
    const returnBy = new Date(launchTime.getTime() + 4 * 60 * 60 * 1000);
    window = `Launch ${launchTime.toISOString().slice(11, 16)}Z, return by ${returnBy
      .toISOString()
      .slice(11, 16)}Z (4h cap)`;
  }

  const gear = [...BASE_GEAR, ...SPECIES_GEAR[species]];

  return {
    result: { status: 'pass', summary: `${launchProfile.label}, ${species}` },
    checks,
    recommendations: { window, gear }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/verdict/runLogistics.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict/runLogistics.ts tests/lib/verdict/runLogistics.test.ts
git commit -m "Layer 4 (Logistics): launch + window + gear recommendations"
```

---

## Task 16: `computeVerdict()` — compose layers with fail-stop logic

**Files:**
- Create: `src/lib/verdict/computeVerdict.ts`
- Test: `tests/lib/verdict/computeVerdict.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/verdict/computeVerdict.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeVerdict } from '../../../src/lib/verdict/computeVerdict.js';
import type { FetchedData } from '../../../src/lib/types.js';

function calmDayData(): FetchedData {
  return {
    ndbc46244: {
      observedAt: '2026-05-18T14:00:00Z',
      windKt: 6, gustKt: 8, windDirDeg: 270,
      waveHtFt: 3.5, dominantPeriodSec: 12, meanWaveDirDeg: 275,
      waterTempF: 52
    },
    ndbc46022: null,
    nwsZone: null,
    nwsPoint: null,
    tides: {
      station: '9418767',
      events: [{ time: '2026-05-18T05:30:00', height: 4.5, type: 'H' }]
    },
    suntimes: {
      byDate: {
        '2026-05-18': {
          civilDawn: '2026-05-18T12:30:00Z',
          sunrise: '2026-05-18T13:05:00Z',
          sunset: '2026-05-19T03:30:00Z',
          civilDusk: '2026-05-19T04:00:00Z'
        }
      }
    }
  };
}

describe('computeVerdict', () => {
  it('all-green calm-day → GO', () => {
    const v = computeVerdict({
      date: '2026-05-18', species: 'rockfish', launch: 'trinidad', data: calmDayData()
    });
    expect(v.verdict).toBe('GO');
    expect(v.layers.legal.status).toBe('pass');
    expect(v.layers.safety.status).toBe('pass');
  });

  it('Layer 1 fail → NO-GO and Layer 2/3/4 not run', () => {
    const v = computeVerdict({
      date: '2026-01-15', species: 'rockfish', launch: 'trinidad', data: calmDayData()
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.layers.legal.status).toBe('fail');
    // Layer 2/3/4 statuses should be 'incomplete' since we short-circuit
    expect(v.layers.safety.status).toBe('incomplete');
  });

  it('Layer 2 fail (May 17 case) → NO-GO', () => {
    const d = calmDayData();
    d.ndbc46244 = {
      observedAt: '2026-05-17T14:00:00Z',
      windKt: 12, gustKt: 16, windDirDeg: 290,
      waveHtFt: 10.5, dominantPeriodSec: 11, meanWaveDirDeg: 295,
      waterTempF: 51.8
    };
    const v = computeVerdict({
      date: '2026-05-17', species: 'rockfish', launch: 'trinidad', data: d
    });
    expect(v.verdict).toBe('NO-GO');
    expect(v.reason).toMatch(/Swell|Gust/);
  });

  it('2+ Layer 2 warns → CONDITIONAL with bailout', () => {
    const d = calmDayData();
    d.ndbc46244 = {
      observedAt: '2026-05-18T14:00:00Z',
      windKt: 13, gustKt: 14, windDirDeg: 270,         // wind warn
      waveHtFt: 4.5, dominantPeriodSec: 10.5, meanWaveDirDeg: 275, // swell-period warn (within 20% of 10s)
      waterTempF: 52
    };
    const v = computeVerdict({
      date: '2026-05-18', species: 'rockfish', launch: 'trinidad', data: d
    });
    expect(v.verdict).toBe('CONDITIONAL');
    expect(v.recommendations.bailout).toBeDefined();
  });

  it('NDBC unavailable → INCOMPLETE', () => {
    const d = calmDayData();
    d.ndbc46244 = null;
    const v = computeVerdict({
      date: '2026-05-18', species: 'rockfish', launch: 'trinidad', data: d
    });
    expect(v.verdict).toBe('INCOMPLETE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/verdict/computeVerdict.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement computeVerdict**

Create `src/lib/verdict/computeVerdict.ts`:

```ts
import type { Verdict, FetchedData, Species, LaunchId, LayerName, LayerResult, Check } from '../types.js';
import { runLegal } from './runLegal.js';
import { runSafety } from './runSafety.js';
import { runQuality } from './runQuality.js';
import { runLogistics } from './runLogistics.js';

export interface ComputeInput {
  date: string;
  species: Species;
  launch: LaunchId;
  data: FetchedData;
}

const NOT_RUN: LayerResult = { status: 'incomplete', summary: 'Not evaluated (earlier layer failed)' };

export function computeVerdict({ date, species, launch, data }: ComputeInput): Verdict {
  const checks: Check[] = [];
  const layers: Record<LayerName, LayerResult> = {
    legal: NOT_RUN, safety: NOT_RUN, quality: NOT_RUN, logistics: NOT_RUN
  };

  // Layer 1
  const legal = runLegal({ species, date });
  layers.legal = legal.result;
  checks.push(...legal.checks);
  if (legal.result.status === 'fail') {
    return {
      date, verdict: 'NO-GO',
      reason: legal.result.summary,
      layers, checks, recommendations: {}
    };
  }

  // Layer 2
  const safety = runSafety({ date, data });
  layers.safety = safety.result;
  checks.push(...safety.checks);
  if (safety.result.status === 'fail') {
    return {
      date, verdict: 'NO-GO',
      reason: safety.result.summary,
      layers, checks, recommendations: {}
    };
  }
  if (safety.result.status === 'incomplete') {
    return {
      date, verdict: 'INCOMPLETE',
      reason: safety.result.summary,
      layers, checks, recommendations: {}
    };
  }

  // Layer 3
  const quality = runQuality({ species, date, data });
  layers.quality = quality.result;
  checks.push(...quality.checks);

  // Layer 4
  const logistics = runLogistics({ species, date, launch, data });
  layers.logistics = logistics.result;
  checks.push(...logistics.checks);

  // Verdict synthesis
  const safetyWarns = safety.checks.filter((c) => c.status === 'warn').length;
  if (safetyWarns >= 2) {
    return {
      date, verdict: 'CONDITIONAL',
      reason: safety.result.summary,
      layers, checks,
      recommendations: {
        ...logistics.recommendations,
        bailout:
          'If conditions degrade en route (wind builds, period drops, fog rolls in), turn back to Trinidad ramp. Don’t commit beyond the harbor mouth on a CONDITIONAL day.'
      }
    };
  }

  return {
    date, verdict: 'GO',
    reason: 'All four layers pass',
    layers, checks,
    recommendations: logistics.recommendations
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/verdict/computeVerdict.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict/computeVerdict.ts tests/lib/verdict/computeVerdict.test.ts
git commit -m "Compose layers into computeVerdict() with fail-stop logic"
```

---

## Task 17: API endpoint `/api/verdict` (orchestration)

**Files:**
- Create: `src/routes/api/verdict/+server.ts`
- Create: `src/lib/server/orchestrate.ts`
- Test: `tests/lib/server/orchestrate.test.ts`

The orchestrator is the testable seam; the `+server.ts` is a thin wrapper that reads query params and binds to Cloudflare's `caches.default`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/server/orchestrate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { orchestrateVerdict } from '../../../src/lib/server/orchestrate.js';
import type { FetchedData } from '../../../src/lib/types.js';

function fakeData(): FetchedData {
  return {
    ndbc46244: {
      observedAt: '2026-05-18T14:00:00Z',
      windKt: 6, gustKt: 8, windDirDeg: 270,
      waveHtFt: 3.5, dominantPeriodSec: 12, meanWaveDirDeg: 275,
      waterTempF: 52
    },
    ndbc46022: null, nwsZone: null, nwsPoint: null,
    tides: { station: '9418767', events: [] },
    suntimes: { byDate: {} }
  };
}

describe('orchestrateVerdict', () => {
  it('returns a response with N days and freshness timestamps', async () => {
    const fetchers = {
      ndbc46244: vi.fn().mockResolvedValue({ ok: true, data: fakeData().ndbc46244, fetchedAt: '2026-05-18T15:00:00Z' }),
      ndbc46022: vi.fn().mockResolvedValue({ ok: false, error: 'down', fetchedAt: '2026-05-18T15:00:00Z' }),
      nwsZone: vi.fn().mockResolvedValue({ ok: false, error: 'down', fetchedAt: '2026-05-18T15:00:00Z' }),
      nwsPoint: vi.fn().mockResolvedValue({ ok: false, error: 'down', fetchedAt: '2026-05-18T15:00:00Z' }),
      tides: vi.fn().mockResolvedValue({ ok: true, data: { station: '9418767', events: [] }, fetchedAt: '2026-05-18T15:00:00Z' }),
      suntimes: vi.fn().mockReturnValue({ byDate: {} })
    };
    const res = await orchestrateVerdict({
      species: 'rockfish', launch: 'trinidad', days: 3, today: '2026-05-18', fetchers
    });
    expect(res.days.length).toBe(3);
    expect(res.days[0].date).toBe('2026-05-18');
    expect(res.days[1].date).toBe('2026-05-19');
    expect(res.freshness.ndbc46244).toBeTruthy();
    expect(res.freshness.ndbc46022).toBeUndefined(); // failed fetch → no freshness recorded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/server/orchestrate.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement orchestrator**

Create `src/lib/server/orchestrate.ts`:

```ts
import type {
  FetchedData, NdbcObservation, NwsZoneForecast, NwsPointForecast,
  TidePredictions, SunTimes, Species, LaunchId, Verdict, VerdictResponse
} from '../types.js';
import type { FetchResult } from '../fetchers/ndbc.js';
import { computeVerdict } from '../verdict/computeVerdict.js';

export interface Fetchers {
  ndbc46244: () => Promise<FetchResult<NdbcObservation>>;
  ndbc46022: () => Promise<FetchResult<NdbcObservation>>;
  nwsZone: () => Promise<FetchResult<NwsZoneForecast>>;
  nwsPoint: () => Promise<FetchResult<NwsPointForecast>>;
  tides: () => Promise<FetchResult<TidePredictions>>;
  suntimes: (dates: string[]) => SunTimes;
}

export interface OrchestrateInput {
  species: Species;
  launch: LaunchId;
  days: number;     // 1..7
  today: string;    // YYYY-MM-DD in Pacific time
  fetchers: Fetchers;
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function orchestrateVerdict(input: OrchestrateInput): Promise<VerdictResponse> {
  const { species, launch, days, today, fetchers } = input;
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(addDays(today, i));

  const [ndbc1, ndbc2, zone, point, tides] = await Promise.all([
    fetchers.ndbc46244(),
    fetchers.ndbc46022(),
    fetchers.nwsZone(),
    fetchers.nwsPoint(),
    fetchers.tides()
  ]);
  const suntimes = fetchers.suntimes(dates);

  const data: FetchedData = {
    ndbc46244: ndbc1.ok ? ndbc1.data! : null,
    ndbc46022: ndbc2.ok ? ndbc2.data! : null,
    nwsZone: zone.ok ? zone.data! : null,
    nwsPoint: point.ok ? point.data! : null,
    tides: tides.ok ? tides.data! : null,
    suntimes
  };

  const verdicts: Verdict[] = dates.map((date) =>
    computeVerdict({ date, species, launch, data })
  );

  return {
    generatedAt: new Date().toISOString(),
    freshness: {
      ndbc46244: ndbc1.ok ? ndbc1.fetchedAt : undefined,
      ndbc46022: ndbc2.ok ? ndbc2.fetchedAt : undefined,
      nwsZone: zone.ok ? zone.fetchedAt : undefined,
      nwsPoint: point.ok ? point.fetchedAt : undefined,
      tides: tides.ok ? tides.fetchedAt : undefined,
      suntimes: new Date().toISOString()
    },
    days: verdicts
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/server/orchestrate.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Wire the `+server.ts` route**

Create `src/routes/api/verdict/+server.ts`:

```ts
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { orchestrateVerdict } from '$lib/server/orchestrate.js';
import { sources, USER_AGENT } from '$lib/config/sources.js';
import { fetchNdbc } from '$lib/fetchers/ndbc.js';
import { fetchNwsZone } from '$lib/fetchers/nws-zone.js';
import { fetchNwsPoint } from '$lib/fetchers/nws-point.js';
import { fetchTides, toApiDate } from '$lib/fetchers/tides.js';
import { computeSunTimes } from '$lib/fetchers/suntimes.js';
import { cachedFetch } from '$lib/fetchers/cache.js';
import { getLaunch } from '$lib/config/launches.js';

const SPECIES = ['rockfish', 'lingcod', 'salmon'] as const;

function todayInPacific(): string {
  // crude: convert "now" to Pacific by subtracting an 8h offset; works year-round for the date level
  // since California is UTC-8 (PST) or UTC-7 (PDT) — both produce the same date for hours 8–24 UTC.
  // For an SSR response taken at, say, 13:00 UTC = 05:00 PST = 06:00 PDT, the date is still "today".
  const now = new Date();
  // Use Intl to get a YYYY-MM-DD string in the America/Los_Angeles zone.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(now); // en-CA gives YYYY-MM-DD
}

export const GET: RequestHandler = async ({ url, platform }) => {
  const speciesParam = (url.searchParams.get('species') ?? 'rockfish') as (typeof SPECIES)[number];
  if (!SPECIES.includes(speciesParam)) throw error(400, 'invalid species');
  const days = Math.max(1, Math.min(7, Number(url.searchParams.get('days') ?? '7')));
  const bypass = url.searchParams.get('refresh') === 'true';

  const cache = platform?.caches?.default;
  const launchProfile = getLaunch('trinidad');

  // Fetcher wiring with edge cache.
  const fetchers = {
    ndbc46244: async () => {
      const res = await cachedFetch(sources.ndbc46244.url, { ttlSec: sources.ndbc46244.ttlSec, bypass, init: { headers: { 'User-Agent': USER_AGENT } } }, fetch, cache);
      return fetchNdbc(sources.ndbc46244.url, async () => res);
    },
    ndbc46022: async () => {
      const res = await cachedFetch(sources.ndbc46022.url, { ttlSec: sources.ndbc46022.ttlSec, bypass, init: { headers: { 'User-Agent': USER_AGENT } } }, fetch, cache);
      return fetchNdbc(sources.ndbc46022.url, async () => res);
    },
    nwsZone: async () => {
      const res = await cachedFetch(sources.nwsZone.url, { ttlSec: sources.nwsZone.ttlSec, bypass, init: { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } } }, fetch, cache);
      return fetchNwsZone(sources.nwsZone.url, async () => res);
    },
    nwsPoint: async () => {
      const { lat, lon } = launchProfile.coordinates;
      return fetchNwsPoint(lat, lon, async (u, init) => {
        return cachedFetch(typeof u === 'string' ? u : u.toString(), {
          ttlSec: sources.nwsPoint.ttlSec, bypass, init: { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } }
        }, fetch, cache);
      });
    },
    tides: async () => {
      const today = todayInPacific();
      const end = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0,10); })();
      const url2 = sources.tides.url(sources.tides.station, toApiDate(today), toApiDate(end));
      return fetchTides(url2, sources.tides.station, async (u) => {
        return cachedFetch(typeof u === 'string' ? u : u.toString(), { ttlSec: sources.tides.ttlSec, bypass }, fetch, cache);
      });
    },
    suntimes: (dates: string[]) => computeSunTimes(dates, launchProfile.coordinates.lat, launchProfile.coordinates.lon)
  };

  const body = await orchestrateVerdict({
    species: speciesParam, launch: 'trinidad', days, today: todayInPacific(), fetchers
  });
  return json(body);
};
```

- [ ] **Step 6: Add a `platform.d.ts` so TypeScript knows about Cloudflare bindings**

Create `src/app.d.ts` (or merge if SvelteKit scaffolded one):

```ts
declare namespace App {
  interface Platform {
    env?: Record<string, unknown>;
    caches?: CacheStorage & { default: Cache };
    cf?: unknown;
    context?: { waitUntil(p: Promise<unknown>): void };
  }
}
```

- [ ] **Step 7: Run `npm test` to make sure nothing regressed**

```bash
npm test
```

Expected: all tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/routes/api/verdict src/lib/server src/app.d.ts tests/lib/server
git commit -m "Add /api/verdict endpoint with edge-cached NOAA fetchers"
```

---

## Task 18: SSR loader for the page

**Files:**
- Create: `src/routes/+page.server.ts`
- Test: (covered by orchestrate test — no new unit test, but we add a one-line type test)

- [ ] **Step 1: Implement the loader**

Create `src/routes/+page.server.ts`:

```ts
import type { PageServerLoad } from './$types';
import type { VerdictResponse } from '$lib/types.js';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const species = url.searchParams.get('species') ?? 'rockfish';
  const refresh = url.searchParams.get('refresh') === 'true';
  const qs = new URLSearchParams({ species, days: '7' });
  if (refresh) qs.set('refresh', 'true');
  const res = await fetch(`/api/verdict?${qs.toString()}`);
  if (!res.ok) {
    return { error: `Verdict service returned ${res.status}`, response: null as VerdictResponse | null };
  }
  const response = (await res.json()) as VerdictResponse;
  return { error: null, response };
};
```

- [ ] **Step 2: Run `npm run build` to confirm types are coherent**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.server.ts
git commit -m "Add SSR loader that calls /api/verdict server-side on first render"
```

---

## Task 19: Verdict pill component

**Files:**
- Create: `src/lib/components/VerdictPill.svelte`
- Test: `tests/lib/components/VerdictPill.test.ts`

- [ ] **Step 1: Install Svelte testing utilities**

```bash
npm install -D @testing-library/svelte @testing-library/jest-dom jsdom
```

Update `vitest.config.ts` to add a jsdom environment for component tests:

```ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    environmentMatchGlobs: [['tests/lib/components/**', 'jsdom']]
  }
});
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/components/VerdictPill.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerdictPill from '../../../src/lib/components/VerdictPill.svelte';

describe('VerdictPill', () => {
  it('renders GO label with green styling', () => {
    const { getByText, container } = render(VerdictPill, { props: { verdict: 'GO' } });
    expect(getByText('GO')).toBeTruthy();
    expect(container.querySelector('[data-verdict="GO"]')).toBeTruthy();
  });

  it('renders CONDITIONAL', () => {
    const { getByText } = render(VerdictPill, { props: { verdict: 'CONDITIONAL' } });
    expect(getByText('CONDITIONAL')).toBeTruthy();
  });

  it('renders NO-GO', () => {
    const { getByText } = render(VerdictPill, { props: { verdict: 'NO-GO' } });
    expect(getByText('NO-GO')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/lib/components/VerdictPill.test.ts
```

Expected: FAIL (component missing).

- [ ] **Step 4: Implement VerdictPill**

Create `src/lib/components/VerdictPill.svelte`:

```svelte
<script lang="ts">
  import type { VerdictLabel } from '$lib/types.js';
  export let verdict: VerdictLabel;
  export let size: 'sm' | 'lg' = 'lg';

  const classes: Record<VerdictLabel, string> = {
    'GO': 'bg-verdict-go text-white',
    'CONDITIONAL': 'bg-verdict-conditional text-white',
    'NO-GO': 'bg-verdict-nogo text-white',
    'INCOMPLETE': 'bg-verdict-incomplete text-white'
  };
</script>

<span
  data-verdict={verdict}
  class="inline-block rounded-full font-bold uppercase tracking-wide {classes[verdict]} {size === 'lg' ? 'px-6 py-2 text-2xl' : 'px-3 py-1 text-xs'}"
>
  {verdict}
</span>
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/lib/components/VerdictPill.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/VerdictPill.svelte tests/lib/components/VerdictPill.test.ts vitest.config.ts package.json package-lock.json
git commit -m "Add VerdictPill component"
```

---

## Task 20: Layer table component (the four-layer breakdown)

**Files:**
- Create: `src/lib/components/LayerTable.svelte`
- Test: `tests/lib/components/LayerTable.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/components/LayerTable.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import LayerTable from '../../../src/lib/components/LayerTable.svelte';
import type { Verdict } from '../../../src/lib/types.js';

const sample: Verdict = {
  date: '2026-05-18', verdict: 'GO', reason: 'all green',
  layers: {
    legal: { status: 'pass', summary: 'rockfish open' },
    safety: { status: 'pass', summary: 'thresholds met' },
    quality: { status: 'pass', summary: 'good window' },
    logistics: { status: 'pass', summary: 'Trinidad ramp' }
  },
  checks: [
    { layer: 'safety', name: 'Swell height', value: '3.5 ft', threshold: '≤ 5 ft', status: 'pass' }
  ],
  recommendations: {}
};

describe('LayerTable', () => {
  it('renders all four layer rows with summaries', () => {
    const { getByText } = render(LayerTable, { props: { verdict: sample } });
    expect(getByText('Legal')).toBeTruthy();
    expect(getByText('Safety')).toBeTruthy();
    expect(getByText('Quality')).toBeTruthy();
    expect(getByText('Logistics')).toBeTruthy();
    expect(getByText('rockfish open')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/components/LayerTable.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement LayerTable**

Create `src/lib/components/LayerTable.svelte`:

```svelte
<script lang="ts">
  import type { Verdict, LayerName, LayerStatus, Check } from '$lib/types.js';
  export let verdict: Verdict;

  const rows: { name: LayerName; label: string }[] = [
    { name: 'legal', label: 'Legal' },
    { name: 'safety', label: 'Safety' },
    { name: 'quality', label: 'Quality' },
    { name: 'logistics', label: 'Logistics' }
  ];

  const icon: Record<LayerStatus, string> = {
    pass: '✓', warn: '⚠', fail: '✗', incomplete: '?'
  };
  const iconClass: Record<LayerStatus, string> = {
    pass: 'text-green-600',
    warn: 'text-yellow-600',
    fail: 'text-red-600',
    incomplete: 'text-neutral-500'
  };

  function checksForLayer(name: LayerName): Check[] {
    return verdict.checks.filter((c) => c.layer === name);
  }
  let expanded: Record<LayerName, boolean> = {
    legal: false, safety: false, quality: false, logistics: false
  };
</script>

<table class="w-full border-collapse text-sm">
  <tbody>
    {#each rows as row}
      {@const status = verdict.layers[row.name].status}
      {@const summary = verdict.layers[row.name].summary}
      <tr class="border-b border-neutral-200 last:border-0">
        <td class="py-3 pr-2 align-top w-10">
          <span class="text-2xl {iconClass[status]}">{icon[status]}</span>
        </td>
        <td class="py-3 pr-3 align-top font-semibold w-24">{row.label}</td>
        <td class="py-3 align-top">
          <div>{summary}</div>
          {#if checksForLayer(row.name).length > 0}
            <button
              type="button"
              class="mt-1 text-xs underline text-neutral-600"
              on:click={() => (expanded[row.name] = !expanded[row.name])}
            >
              {expanded[row.name] ? 'Hide' : 'Show'} {checksForLayer(row.name).length} check{checksForLayer(row.name).length === 1 ? '' : 's'}
            </button>
            {#if expanded[row.name]}
              <ul class="mt-2 space-y-1 text-xs text-neutral-700">
                {#each checksForLayer(row.name) as c}
                  <li>
                    <span class="{iconClass[c.status === 'unknown' ? 'incomplete' : c.status]}">{icon[c.status === 'unknown' ? 'incomplete' : c.status]}</span>
                    <strong>{c.name}:</strong> {c.value} ({c.threshold})
                    {#if c.note}<div class="ml-4 italic text-neutral-500">{c.note}</div>{/if}
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/components/LayerTable.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/LayerTable.svelte tests/lib/components/LayerTable.test.ts
git commit -m "Add LayerTable component with expandable per-layer checks"
```

---

## Task 21: Day card component (today + expandable week rows)

**Files:**
- Create: `src/lib/components/DayCard.svelte`

This component renders both the prominent "today" card and the collapsed week-strip rows. The page passes a `mode` prop.

- [ ] **Step 1: Implement DayCard**

Create `src/lib/components/DayCard.svelte`:

```svelte
<script lang="ts">
  import type { Verdict, Species } from '$lib/types.js';
  import VerdictPill from './VerdictPill.svelte';
  import LayerTable from './LayerTable.svelte';
  import { regs } from '$lib/config/regs.js';

  export let verdict: Verdict;
  export let species: Species;
  export let mode: 'today' | 'row' = 'row';
  export let lowConfidence = false;

  let expanded = mode === 'today';

  function fmtDate(d: string): string {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  }

  $: showSalmonHotline = species === 'salmon' && (verdict.verdict === 'GO' || verdict.verdict === 'CONDITIONAL');
  $: hotline = regs.salmon.hotlinePhone;
</script>

<article
  class="rounded-lg border border-neutral-200 bg-white {mode === 'today' ? 'p-4 shadow-sm' : 'p-3'}"
  class:opacity-60={lowConfidence}
>
  <header class="flex items-center justify-between gap-2 cursor-pointer" on:click={() => (expanded = !expanded)}>
    <div class="flex items-center gap-3">
      <span class="font-semibold {mode === 'today' ? 'text-lg' : ''}">
        {mode === 'today' ? 'Tomorrow' : fmtDate(verdict.date)}
      </span>
      <VerdictPill verdict={verdict.verdict} size={mode === 'today' ? 'lg' : 'sm'} />
    </div>
    <div class="text-sm text-neutral-600 truncate">{verdict.reason}</div>
  </header>

  {#if lowConfidence}
    <div class="mt-1 text-xs text-neutral-500 italic">Forecast confidence drops past day 5.</div>
  {/if}

  {#if expanded}
    <div class="mt-3">
      <LayerTable {verdict} />
    </div>

    {#if verdict.recommendations.window}
      <div class="mt-3 rounded bg-neutral-50 p-3 text-sm">
        <strong>Window:</strong> {verdict.recommendations.window}
      </div>
    {/if}

    {#if verdict.recommendations.bailout}
      <div class="mt-2 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
        <strong>Bailout plan:</strong> {verdict.recommendations.bailout}
      </div>
    {/if}

    {#if verdict.recommendations.gear && verdict.recommendations.gear.length > 0}
      <details class="mt-2">
        <summary class="cursor-pointer text-sm font-medium">Gear pack list</summary>
        <ul class="ml-4 mt-1 list-disc text-sm text-neutral-700">
          {#each verdict.recommendations.gear as g}
            <li>{g}</li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if verdict.verdict === 'GO' || verdict.verdict === 'CONDITIONAL'}
      <div class="mt-3 rounded border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
        <strong>Verify within 2 hours of launch:</strong>
        <ul class="ml-4 mt-1 list-disc">
          <li>USCG Bar status — <a class="underline" href="tel:7078396113">707-839-6113</a> or VHF 22A</li>
          {#if showSalmonHotline && hotline}
            <li><strong>Salmon hotline — must call</strong> — <a class="underline" href="tel:{hotline.replace(/-/g, '')}">{hotline}</a></li>
          {/if}
        </ul>
        Conditions can change fast on the North Coast.
      </div>
    {/if}
  {/if}
</article>
```

- [ ] **Step 2: Run `npm test` and `npm run build` for regression**

```bash
npm test && npm run build
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DayCard.svelte
git commit -m "Add DayCard component (today + week-row modes)"
```

---

## Task 22: Main page composing the UI

**Files:**
- Modify: `src/routes/+page.svelte` (replace SvelteKit-default content)

- [ ] **Step 1: Replace `+page.svelte`**

Replace `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import type { Species } from '$lib/types.js';
  import DayCard from '$lib/components/DayCard.svelte';

  export let data: PageData;

  let species: Species = 'rockfish';
  let refreshing = false;

  async function setSpecies(s: Species) {
    species = s;
    const qs = new URLSearchParams(window.location.search);
    qs.set('species', s);
    history.replaceState({}, '', `?${qs.toString()}`);
    refreshing = true;
    const res = await fetch(`/api/verdict?${qs.toString()}&days=7`);
    if (res.ok) data.response = await res.json();
    refreshing = false;
  }

  async function refresh() {
    refreshing = true;
    const res = await fetch(`/api/verdict?species=${species}&days=7&refresh=true`);
    if (res.ok) data.response = await res.json();
    refreshing = false;
  }

  $: days = data.response?.days ?? [];
  $: today = days[0];
  $: rest = days.slice(1);

  function ago(iso: string | undefined): string {
    if (!iso) return 'unavailable';
    const ms = Date.now() - Date.parse(iso);
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min ago`;
    return `${Math.round(min / 60)} h ago`;
  }

  // Stale = older than 2× the source's expected refresh TTL.
  const STALE_THRESHOLDS_MIN: Record<string, number> = {
    ndbc46244: 20, ndbc46022: 20, nwsZone: 120, nwsPoint: 120, tides: 2880
  };
  function isStale(iso: string | undefined, key: keyof typeof STALE_THRESHOLDS_MIN): boolean {
    if (!iso) return false; // unavailable is its own state, handled by the ago() output
    const minOld = (Date.now() - Date.parse(iso)) / 60000;
    return minOld > STALE_THRESHOLDS_MIN[key];
  }
</script>

<svelte:head>
  <title>humboldt.fish — go / no-go</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main class="mx-auto max-w-2xl p-3">
  <header class="sticky top-0 z-10 -mx-3 mb-3 flex items-center gap-2 bg-white/95 px-3 py-2 backdrop-blur border-b border-neutral-200">
    <div class="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm">
      {#each (['rockfish', 'lingcod', 'salmon'] as const) as s}
        <button
          type="button"
          class="px-3 py-1 rounded-full {species === s ? 'bg-white shadow font-semibold' : 'text-neutral-600'}"
          on:click={() => setSpecies(s)}
        >
          {s}
        </button>
      {/each}
    </div>
    <span class="text-xs text-neutral-500">Trinidad Harbor</span>
    <button
      type="button"
      class="ml-auto rounded-full bg-neutral-100 px-3 py-1 text-sm"
      on:click={refresh}
      disabled={refreshing}
    >
      {refreshing ? '…' : '↻'}
    </button>
  </header>

  {#if data.error}
    <div class="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      Could not load verdicts: {data.error}. Verify NOAA directly via <a class="underline" href="tel:7078396113">USCG 707-839-6113</a> or VHF 22A.
    </div>
  {:else if today}
    <DayCard verdict={today} {species} mode="today" />

    <h2 class="mt-5 mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Next days</h2>
    <div class="space-y-2">
      {#each rest as v, i}
        <DayCard verdict={v} {species} mode="row" lowConfidence={i >= 4} />
      {/each}
    </div>

    <footer class="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
      <p>Data freshness:</p>
      <ul class="mt-1 space-y-0.5">
        <li class:text-red-600={isStale(data.response?.freshness.ndbc46244, 'ndbc46244')}>Buoy 46244: {ago(data.response?.freshness.ndbc46244)}</li>
        <li class:text-red-600={isStale(data.response?.freshness.nwsZone, 'nwsZone')}>NWS PZZ450: {ago(data.response?.freshness.nwsZone)}</li>
        <li class:text-red-600={isStale(data.response?.freshness.nwsPoint, 'nwsPoint')}>NWS Trinidad point: {ago(data.response?.freshness.nwsPoint)}</li>
        <li class:text-red-600={isStale(data.response?.freshness.tides, 'tides')}>Tides 9418767: {ago(data.response?.freshness.tides)}</li>
      </ul>
      <p class="mt-3">
        Thresholds and decision logic:
        <a class="underline" href="https://github.com/samwedll/humboldt-fishing-checker/tree/main/reference">reference/ on GitHub</a>
      </p>
    </footer>
  {/if}
</main>
```

> **Note:** the GitHub URL above assumes the repo will be pushed under `samwedll/humboldt-fishing-checker`. Update the URL after the first push if the slug differs.

- [ ] **Step 2: Run dev server and verify**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. You should see the controls bar, today card, and week strip. NOAA fetches happen server-side so the page should render with real data on first load (assuming you're online).

- [ ] **Step 3: Run `npm run build` for a final compile check**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "Wire main page: controls, today card, week strip, freshness footer"
```

---

## Task 23: Smoke test script for live-NOAA checks

**Files:**
- Create: `scripts/smoke.ts`

- [ ] **Step 1: Implement the smoke script**

Create `scripts/smoke.ts`:

```ts
#!/usr/bin/env tsx
import { sources, USER_AGENT } from '../src/lib/config/sources.js';
import { parseNdbc } from '../src/lib/fetchers/ndbc.js';
import { parseNwsZone } from '../src/lib/fetchers/nws-zone.js';
import { parseNwsPointMeta, parseNwsPointForecast } from '../src/lib/fetchers/nws-point.js';
import { parseTides, toApiDate } from '../src/lib/fetchers/tides.js';
import { computeSunTimes } from '../src/lib/fetchers/suntimes.js';

const HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' };

async function check(name: string, fn: () => Promise<unknown>) {
  process.stdout.write(`${name.padEnd(40)} `);
  try {
    const value = await fn();
    console.log('OK', typeof value === 'object' && value ? Object.keys(value).slice(0, 4).join(',') : '');
  } catch (e) {
    console.log('FAIL', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

await check('NDBC 46244 parse', async () => {
  const res = await fetch(sources.ndbc46244.url);
  return parseNdbc(await res.text());
});
await check('NDBC 46022 parse', async () => {
  const res = await fetch(sources.ndbc46022.url);
  return parseNdbc(await res.text());
});
await check('NWS PZZ450 parse', async () => {
  const res = await fetch(sources.nwsZone.url, { headers: HEADERS });
  return parseNwsZone(await res.json());
});
await check('NWS point Trinidad parse', async () => {
  const meta = await fetch('https://api.weather.gov/points/41.0586,-124.1431', { headers: HEADERS });
  const m = parseNwsPointMeta(await meta.json());
  const fc = await fetch(m.forecastUrl, { headers: HEADERS });
  return parseNwsPointForecast(await fc.json());
});
await check('Tides 9418767 parse', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const url = sources.tides.url(sources.tides.station, toApiDate(today), toApiDate(end));
  const res = await fetch(url);
  return parseTides(await res.json(), sources.tides.station);
});
await check('SunCalc compute', async () => {
  return computeSunTimes(['2026-05-18'], 41.0586, -124.1431);
});
```

- [ ] **Step 2: Run the smoke test**

```bash
npm run smoke
```

Expected: All six checks print OK. If any FAIL, the corresponding Zod schema or parser has drifted from the live response — update it before deploying.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke.ts
git commit -m "Add live-NOAA smoke test (npm run smoke)"
```

---

## Task 24: Project docs (README, CONTRIBUTING)

**Files:**
- Modify: `README.md`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Update README.md**

Replace `README.md` content with:

```markdown
# humboldt.fish

A mobile-first website that renders a four-layer go/no-go verdict for kayak fishing out of Trinidad Harbor (Humboldt County, CA). Pulls live NOAA marine data through a Cloudflare Pages Function and applies the user's personal thresholds.

**Live:** https://humboldt.fish

## Local development

```bash
npm install
npm run dev           # http://localhost:5173
npm test              # unit + schema tests
npm run smoke         # live-NOAA endpoint smoke test (not in CI)
npm run build         # Cloudflare Pages production build
```

## Architecture

- SvelteKit + TypeScript + `@sveltejs/adapter-cloudflare`
- Pure verdict module in `src/lib/verdict/` — fully unit-tested
- Per-source NOAA fetchers in `src/lib/fetchers/` with Zod schemas
- Edge-cached responses via Cloudflare Cache API, per-source TTLs in `src/lib/config/sources.ts`
- Threshold numbers and regulations in `src/lib/config/` mirror canonical docs in `reference/`

See `docs/superpowers/specs/2026-05-17-humboldt-fishing-web-v1-design.md` for the full design rationale.

## Conventions

- `reference/` is the canonical source of truth for thresholds, launches, regs, and data sources. Read-only inside Claude Code sessions. Updates happen in Claude.ai chat and get copied back.
- `src/lib/config/*.ts` mirrors `reference/`. When a reference file changes, sync the TS file in the same commit. See `CONTRIBUTING.md`.
- Conservative defaults are not negotiable in-conversation. If a threshold says ≤5 ft, the verdict is NO-GO at 5.1 ft.
```

- [ ] **Step 2: Create CONTRIBUTING.md**

Create `CONTRIBUTING.md`:

```markdown
# Contributing

## The reference/ ↔ src/lib/config/ sync rule

`reference/` is the canonical source of truth for thresholds, launches, regulations, and data sources. `src/lib/config/` files mirror those numbers and rules as TypeScript so the runtime can apply them.

When you change a file in `reference/`, update the corresponding file in `src/lib/config/` in the **same commit**:

| reference file | mirror in code |
|---|---|
| `reference/thresholds.md` | `src/lib/config/thresholds.ts` |
| `reference/launches.md` | `src/lib/config/launches.ts` |
| `reference/regs/rockfish-lingcod-*.md` | `src/lib/config/regs.ts` (rockfish, lingcod entries) |
| `reference/regs/salmon-*.md` | `src/lib/config/regs.ts` (salmon entry) |
| `reference/data-sources.md` | `src/lib/config/sources.ts` |

If you forget, the corresponding test should catch it (each `src/lib/config/*.ts` has unit tests that pin specific numbers). When the test fails, fix the mirror and re-run.

## NOAA endpoint drift

If `npm run smoke` fails for any source, an endpoint shape has changed. Update the Zod schema in the relevant `src/lib/fetchers/*.ts`, save a new fixture in `tests/fixtures/`, and re-run unit tests.

## Tests

- `npm test` — must pass before any commit
- `npm run smoke` — run before deploys to catch live-endpoint drift
```

- [ ] **Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "Document local dev, architecture, and the reference/ sync rule"
```

---

## Task 25: First Cloudflare Pages deploy + DNS

This task is partially manual (Cloudflare dashboard); commands cover the codebase preparation.

**Files:**
- Verify: `wrangler.toml`, `package.json` build script, `svelte.config.js`

- [ ] **Step 1: Push the repo to GitHub**

```bash
gh repo create samwedll/humboldt-fishing-checker --public --source=. --remote=origin --push
```

If `gh` is not installed or the user prefers a private repo, create the repo manually in the GitHub UI, then:

```bash
git remote add origin git@github.com:samwedll/humboldt-fishing-checker.git
git push -u origin main
```

- [ ] **Step 2: Create the Cloudflare Pages project**

In the Cloudflare dashboard:
1. Pages → Create application → Connect to Git → select `humboldt-fishing-checker`
2. Build command: `npm run build`
3. Build output directory: `.svelte-kit/cloudflare`
4. Environment variables: none for v1
5. Deploy

First deploy URL will be `https://humboldt-fishing-checker.pages.dev` (or similar). Verify the page loads and that `/api/verdict` returns JSON.

- [ ] **Step 3: Point humboldt.fish at the project**

In Cloudflare dashboard:
1. If `humboldt.fish` is registered through Cloudflare: Pages → project → Custom domains → Set up → enter `humboldt.fish` and `www.humboldt.fish` → it auto-creates DNS.
2. If registered elsewhere: add `humboldt.fish` to Cloudflare as a site first (free plan is fine), update registrar nameservers to Cloudflare's, then follow step 1.

DNS propagation typically completes within an hour. Cloudflare provisions the SSL cert automatically.

- [ ] **Step 4: Verify production**

```bash
curl -s https://humboldt.fish/api/verdict?species=rockfish&days=7 | jq '.days[0]'
```

Expected: a Verdict object for today.

- [ ] **Step 5: Tag the release**

```bash
git tag -a v1.0.0 -m "v1.0.0: humboldt.fish initial deploy"
git push --tags
```

---

## Final self-review checklist (for the implementing engineer)

After completing all tasks above, before declaring the project done, run:

- [ ] `npm test` — all unit and schema tests pass
- [ ] `npm run smoke` — all six live-NOAA checks pass
- [ ] `npm run build` — production build succeeds with no warnings about missing routes or types
- [ ] Manual smoke in browser:
  - [ ] Page loads on desktop and mobile (resize devtools or use a phone)
  - [ ] Each species toggle changes the verdicts (lingcod/salmon may show NO-GO in Layer 1 if out-of-season; that's correct)
  - [ ] Refresh button (`↻`) triggers a fresh fetch (check Network tab in devtools — `/api/verdict?refresh=true`)
  - [ ] Expand a future day — layer table appears
  - [ ] Verify the 2026-05-17 dangerous-buoy fixture test still passes (this is the most important regression)
- [ ] Production URL `https://humboldt.fish` resolves with valid SSL and returns the same content as `*.pages.dev`

If any check fails, do not declare done — fix and re-verify.
