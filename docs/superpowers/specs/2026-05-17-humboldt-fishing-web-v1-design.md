# Humboldt Fishing Checker — Web v1 Design

**Date:** 2026-05-17
**Status:** Design, pre-implementation
**Authors:** the user + Claude

---

## Goal

Replace the planned Python CLI (Phase 1 in `HANDOFF.md`) with a mobile-first website that the user uses from a phone to get a four-layer go/no-go verdict for kayak fishing out of Humboldt County. v1 is a single-user proof of concept that also serves as the architectural seed for a future, broader recreational platform.

## Non-goals (v1)

- Multi-user, accounts, auth.
- Configurable thresholds in-UI (thresholds live in code; edit + push).
- Locations outside Humboldt County.
- Activities other than kayak fishing for rockfish / lingcod / salmon.
- A Python CLI. Skipped in favor of going straight to web. The Phase 3 MCP server will wrap the same TypeScript verdict function.
- E2E tests. Persistence. Server-side analytics.

## Audience and primary use case

One user (the user). Two use cases the design serves directly:

1. **Tomorrow check** — pre-bed glance from phone: is tomorrow a go? Single tap from home screen, sub-2-second answer.
2. **Week planning** — Sunday afternoon scan of the next 5-7 days: which days look fishable, what's the species/launch fit?

## Scope

- **Species:** rockfish, lingcod, salmon (each with its own Layer 1 legal check from `reference/regs/`).
- **Launch:** Trinidad Harbor only. Lagoons, Mad River Slough, and Humboldt Bay interior are deferred to a later phase. Trinidad is the canonical "open Pacific" launch per `reference/launches.md` and is the only one the user targets in v1.
- **Horizon:** today + up to 6 days out. Days 6-7 marked low-confidence per NWS forecast reliability.
- **Hard rules baked in:** No Humboldt Bay jetty crossings ever. Trinidad-only for open ocean (already covered by single-launch scope). Solo-outside-jetties = NO-GO regardless of conditions. (All from `reference/thresholds.md`.)
- **Domain:** `humboldt.fish` (registered).

---

## Architecture

**Stack:** SvelteKit (TypeScript) + `@sveltejs/adapter-cloudflare`, deployed to Cloudflare Pages. Pages Functions handle NOAA fetching server-side at the edge. Tailwind for styling. Vitest for unit tests. Zod for response schema validation.

**Why this stack:**

- Cloudflare Pages + Functions is one deploy, free tier, fits the user's existing Cloudflare workflow (Pages/R2 already in their stack).
- Server-side fetching eliminates NOAA CORS issues (NDBC and tgftp don't set CORS headers; api.weather.gov and tidesandcurrents do, but mixing breaks consistency).
- Cloudflare Cache API gives per-source TTL caching at the edge — solves the "stale federal data" problem that motivated this project.
- SvelteKit produces small bundles, server-renders the initial page from the same `/api/verdict` logic, and the verdict module is just TypeScript — no React reconciliation overhead for a verdict-table UI.
- The verdict function is pure TypeScript with no I/O. It is the unit-testable core and the future Phase 3 MCP server's logic verbatim.

**Repo layout** (SvelteKit at the root; `reference/` remains an untouched doc tree):

```
humboldt-fishing-checker/
├── reference/                  # canonical docs (unchanged, read-only in code sessions)
├── docs/superpowers/specs/     # this spec lives here
├── src/
│   ├── lib/
│   │   ├── config/             # thresholds.ts, launches.ts, regs.ts, sources.ts
│   │   ├── fetchers/           # ndbc.ts, nws.ts, tides.ts, suntimes.ts
│   │   ├── verdict/            # computeVerdict(), layer functions
│   │   └── types.ts            # shared shapes (Verdict, Check, LayerResult, etc.)
│   ├── routes/
│   │   ├── +page.server.ts     # SSR loader: calls verdict logic, returns initial week
│   │   ├── +page.svelte        # the whole app
│   │   └── api/
│   │       └── verdict/+server.ts   # JSON endpoint for client-side refreshes
│   ├── app.html
│   └── app.css
├── tests/
│   ├── fixtures/               # saved NOAA responses, including 2026-05-17 buoy 46244
│   └── verdict/                # unit tests for every fail/warn path
├── svelte.config.js
├── tailwind.config.js
├── vitest.config.ts
├── package.json
├── CLAUDE.md
├── HANDOFF.md
└── README.md
```

**Config files mirror `reference/`.** `src/lib/config/thresholds.ts`, `launches.ts`, and `regs.ts` hand-port the numbers and rules from `reference/thresholds.md`, `reference/launches.md`, and `reference/regs/`. Source of truth remains in `reference/`. When the user updates a reference file (via Claude.ai conversation, per the existing project rule), they sync the corresponding TS file in the same commit. A `CONTRIBUTING.md` will codify this rule.

## Components

### Pure verdict module (`src/lib/verdict/`)

```ts
// src/lib/types.ts
type Verdict = {
  date: string;                    // YYYY-MM-DD, local Pacific time
  verdict: "GO" | "CONDITIONAL" | "NO-GO" | "INCOMPLETE";
  reason: string;                  // short headline, e.g. "Swell 6.2 ft @ 9s"
  layers: {
    legal: LayerResult;
    safety: LayerResult;
    quality: LayerResult;
    logistics: LayerResult;
  };
  checks: Check[];                 // every individual threshold result
  recommendations: {
    window?: string;               // e.g. "Launch 0530, return by 1000"
    gear?: string[];
    bailout?: string;              // present only on CONDITIONAL
  };
};

type LayerResult = { status: "pass" | "warn" | "fail" | "incomplete"; summary: string };
type Check = {
  layer: "legal" | "safety" | "quality" | "logistics";
  name: string;                    // e.g. "Sustained wind"
  value: string;                   // e.g. "12 kt"
  threshold: string;               // e.g. "≤ 15 kt"
  status: "pass" | "warn" | "fail" | "unknown";
  note?: string;
};

// src/lib/verdict/computeVerdict.ts
// Launch is in the signature for forward compatibility; v1 always passes "trinidad".
function computeVerdict(args: {
  date: string;
  species: "rockfish" | "lingcod" | "salmon";
  launch: "trinidad";
  data: FetchedData;
}): Verdict;
```

`computeVerdict` has no I/O. Layer functions (`runLegal`, `runSafety`, `runQuality`, `runLogistics`) are called in order. Layer-1 fail short-circuits to NO-GO before Layer 2 runs. Layer-2 fail short-circuits to NO-GO before Quality/Logistics run.

### Fetchers (`src/lib/fetchers/`)

One module per source. Each exports a function `fetchX(env): Promise<Result<XData, FetchError>>` where `env` is the Cloudflare bindings object (used for Cache API access). Each fetcher:

1. Builds the request URL.
2. Calls `fetch()` with `cf: { cacheTtl, cacheEverything: true }` and/or Cache API for stale-while-revalidate.
3. Parses the response with a Zod schema.
4. Returns `{ ok: true, data, fetchedAt }` or `{ ok: false, error }`.

### API endpoint (`src/routes/api/verdict/+server.ts`)

`GET /api/verdict?species=rockfish&days=7`

1. Resolves and validates query params (default `species=rockfish`, `days=7`). Launch is hardcoded to Trinidad in v1; the `launch` param is reserved for the future expansion but not exposed in v1's UI or accepted on the endpoint.
2. Calls all fetchers in parallel via `Promise.all`. Per-fetcher failures are isolated.
3. Computes the Pacific-time date list for `[today, today+1, …, today+days-1]`.
4. For each date, calls `computeVerdict()` with the resolved data slice (NWS forecast period for that date, NDBC for today only, etc.).
5. Returns the JSON described in the spec section above.

### SSR loader (`src/routes/+page.server.ts`)

Calls the same verdict logic at request time so the initial HTML ships with data populated. Avoids a client-side loading spinner on first load. Defaults: today through today+6, rockfish, Trinidad.

### Single-route UI (`src/routes/+page.svelte`)

See "UI" below. No client-side routing; toggle changes re-fetch `/api/verdict` and swap the table data.

## Data flow

```
User opens https://<domain>/
   ↓
Pages Function +page.server.ts runs
   ↓
   ├─ fetchNDBC(46244) ──┐
   ├─ fetchNDBC(46022) ──┤   all in Promise.all,
   ├─ fetchNWS(PZZ450) ──┤   each cache-checked
   ├─ fetchNWSPoint(Trinidad) ─┤
   ├─ fetchTides(9418767)─┤
   └─ computeSunTimes()──┘
   ↓
For each date in next 7:
   computeVerdict({ date, species, launch, data })
   ↓
Serialize JSON → SvelteKit hydrates +page.svelte
   ↓
User taps species toggle
   ↓
Client fetch('/api/verdict?…') → swap data → re-render
   ↓
User taps "refresh" → fetch with cache-bypass header → re-render
```

## Data sources & caching

| Source | Endpoint | Cache TTL | Notes |
|---|---|---:|---|
| NDBC 46244 (Humboldt Bay) | `https://www.ndbc.noaa.gov/data/realtime2/46244.txt` | 10 min | Primary live signal. The one that lied with stale data on 2026-05-17. |
| NDBC 46022 (Eel River) | `https://www.ndbc.noaa.gov/data/realtime2/46022.txt` | 10 min | Offshore swell sanity check. |
| NWS marine PZZ450 | `https://api.weather.gov/zones/forecast/PZZ450/forecast` | 1 h | Humboldt waters out to 10 nm. NWS issues ~4×/day. **PZZ455 is wrong zone — never use.** |
| NWS point forecast | `https://api.weather.gov/points/{lat,lon}` → forecast URL | 1 h | Hourly wind/visibility for Trinidad (41.0586, -124.1431) and Eureka (40.766, -124.235). |
| Tides station 9418767 | `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?...&station=9418767` | 24 h | Predictions are deterministic; cheap to cache long. |
| Sun & civil twilight | local compute via `suncalc` npm | — | No network. Inputs: date + Eureka lat/lon. |
| USCG bar advisory | **not fetched in v1** | — | No clean machine-readable feed. UI shows hotline `707-839-6113` + VHF 22A. |
| Salmon season hotline | **not fetched in v1** | — | UI shows `707-576-3429` on salmon-day cards as mandatory manual verify. |

**Cache implementation:** Cloudflare Cache API keyed by URL. On miss: fetch, parse, write to cache with `Cache-Control: public, max-age=<ttl>`. Stale-while-revalidate so users never wait on NOAA latency. Each response object carries `fetchedAt` so the UI can render freshness.

**Forecast horizon caveat:** NWS marine forecasts reliably cover ~5 days. Days 6-7 are degraded confidence; UI marks them visually. NDBC buoys are observations only — they only populate today's card.

## UI

Mobile-first single route. No client-side routing. Species is the only user-controlled variable in v1; launch is fixed to Trinidad Harbor.

```
┌─────────────────────────────────────┐
│ [rockfish ▾]  Trinidad Harbor  [↻] │  ← sticky controls
├─────────────────────────────────────┤
│ ╔═════════════════════════════════╗ │
│ ║          TOMORROW               ║ │
│ ║   ╭───────────────────────╮     ║ │
│ ║   │        GO             │     ║ │  ← big colored pill
│ ║   ╰───────────────────────╯     ║ │
│ ║   Swell 4 ft @ 12s, W 8 kt      ║ │  ← one-line headline
│ ║                                  ║ │
│ ║   ✓ Legal     Rockfish open      ║ │
│ ║   ✓ Safety    All thresholds met ║ │
│ ║   ✓ Quality   Slack 0612         ║ │
│ ║   ✓ Logistics Trinidad ramp      ║ │
│ ║   [▸ tap to expand each layer]   ║ │
│ ║                                  ║ │
│ ║   📞 Verify within 2h of launch: ║ │
│ ║      USCG Bar 707-839-6113       ║ │
│ ╚═════════════════════════════════╝ │
├─────────────────────────────────────┤
│ Mon 5/18  ●●○  Swell 6 ft @ 9s    ▸│  ← collapsed day rows
│ Tue 5/19  ●○○  Wind 18 kt gust 25 ▸│
│ Wed 5/20  ●●●  Looks great        ▸│
│ Thu 5/21  ●●○  Borderline period  ▸│
│ Fri 5/22  ◌◌◌  (low confidence)   ▸│  ← days 6-7 muted
│ Sat 5/23  ◌◌◌  (low confidence)   ▸│
├─────────────────────────────────────┤
│ Data freshness:                     │
│  Buoy 46244: 7 min ago              │
│  NWS PZZ450: 38 min ago             │
│  Tides: 4 h ago                     │
│                                      │
│  Thresholds → reference/ on GitHub  │
└─────────────────────────────────────┘
```

- Verdict pills: green (GO), yellow (CONDITIONAL), red (NO-GO), gray (INCOMPLETE).
- Day rows tap to expand inline into the same four-layer table as today's card.
- Tap-to-call phone links on hotline numbers (`tel:` URIs).
- Salmon-day cards show salmon hotline `707-576-3429` prominently and treat it as a manual verify step.
- Footer link to `reference/` on GitHub for "what do the thresholds mean?"
- Tailwind for utility classes. Bundle target: < 100 KB transferred on first load (no web fonts, system font stack, no client framework state library).

## Error handling

Philosophy: fail loud, never silently degrade a verdict.

| Failure | Behavior |
|---|---|
| Single source unreachable / schema-drift | That source's checks render as "?" (unknown). Layer status becomes `incomplete`. Day verdict label is `INCOMPLETE` (gray pill). Reason line is explicit: "Could not reach NDBC 46244." |
| All sources unreachable | Top banner: "NOAA data unreachable — verify directly via [phone numbers + links]." No verdicts rendered. |
| Stale data (older than 2× expected refresh) | Freshness timestamp renders red. Verdict still shows with a "data stale" badge. |
| One day's verdict computation throws | Other days still render. Failing day card shows error. |
| Salmon hotline closed (selected species = salmon, date in season) | UI shows hotline number with a "must call before launch" badge regardless of other conditions. |

No automatic retries in v1. No fallback source chains. If something is wrong, it shows.

## Testing

**Vitest unit tests** (`tests/verdict/`):

- Every Layer 1 fail path (out-of-season for each species, MPA flag).
- Every Layer 2 fail path (each individual threshold from `reference/thresholds.md`).
- Every Layer 2 warn path (within 20% of fail).
- CONDITIONAL trigger (≥2 warns).
- Hard rule: solo-outside-jetties → NO-GO regardless of conditions. (Trinidad outside the breakwater is open Pacific and counts as outside-jetties for the year-1 solo rule.)
- **The 2026-05-17 case:** buoy 46244 fixture with 10.5 ft @ 11s WNW → NO-GO with reason "Swell 10.5 ft exceeds 5 ft threshold."
- Edge: NWS forecast missing day 5 → that day renders INCOMPLETE.

**Schema tests** (`tests/fetchers/`):

- Zod schema parses saved fixture for each NOAA endpoint.
- Schema rejects a known-broken response shape.

**Smoke test** (not in CI, run manually on Fedora dev box):

- `npm run smoke` hits live NOAA endpoints and asserts the Zod schemas still parse. the user runs this when something feels off.

No E2E tests. The single-route static page doesn't justify Playwright in v1.

## Build & deploy

- `npm run dev` — local SvelteKit dev server.
- `npm run build` — SvelteKit + Cloudflare adapter build.
- `npm run preview` — local preview of the Cloudflare-adapted build.
- `npm test` — vitest unit + schema tests.
- `npm run smoke` — live-NOAA smoke test (excluded from CI).

Deploy via Cloudflare Pages Git integration. First deploy after the GitHub repo is pushed; Pages auto-deploys on push to `main`. `humboldt.fish` points at the Pages project after first successful deploy (Cloudflare DNS or external registrar — TBD at deploy time).

## Open questions / decisions deferred

- **Additional launches (Big Lagoon, Stone Lagoon, Mad River Slough, Humboldt Bay interior)** — out of scope for v1. v1 ships Trinidad-only. The verdict module's `launch` parameter exists in the type signature so adding launches later is additive. Lagoon launches will skip Layer 2 swell/bar checks per `reference/launches.md`.
- **Future species (Pacific halibut, surfperch, Dungeness crab, sturgeon, steelhead)** — out of scope for v1. The species enum + Layer-1 module is structured so adding one is a config-and-regs file addition, not a refactor.
- **Phase 3 MCP server** — out of scope. Architecturally enabled because `computeVerdict()` is pure: an MCP wrapper is roughly "expose the same function as a tool."
- **Generalization to other locations** — out of scope. `src/lib/config/sources.ts` hardcodes the Humboldt NWS zone, NDBC buoys, and tide stations. A future zip-code-driven version would lift these into a lookup keyed by location, but v1 makes no concession to that.

## Risks

| Risk | Mitigation |
|---|---|
| NOAA endpoint shape drift | Per-fetcher Zod schemas + manual `npm run smoke`. Drift surfaces as `INCOMPLETE`, not a wrong verdict. |
| Threshold drift between `reference/` and `src/lib/config/` | CONTRIBUTING rule: update both in the same commit. Diff size is small; review catches mismatch. |
| Cloudflare Free tier limits (100k Pages Function requests/day) | Single-user usage. Edge cache absorbs >95% of traffic. Effectively no cost. |
| User trusts a green verdict and skips the hotline check | UI mandates the hotline reminder block at the bottom of every GO/CONDITIONAL card; salmon-day verdicts treat the hotline as a hard manual gate. |
| Fedora dev box is the dev box; Cloudflare Pages dev tooling on Fedora 43 | `wrangler` runs fine on Linux. No special concern. |
