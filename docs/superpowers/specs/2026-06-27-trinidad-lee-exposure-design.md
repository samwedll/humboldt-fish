# Trinidad lee/exposure model + swell-threshold bump + Bixpy gear

**Date:** 2026-06-27
**Status:** Approved (design), pending implementation plan
**Branch:** `trinidad-lee-exposure`

## Problem

Trinidad (the only open-Pacific launch) returns NO-GO on nearly every day —
one GO in the past month. This is not a bug; it is the conservative swell
gates meeting real North Coast water. Empirically, over the last ~45 days of
NDBC 46244 (2,203 obs):

- Median significant wave height (WVHT) = 6.6 ft; only 21% of obs are ≤ 5 ft.
- Period ≥ 10 s passes 51% of the time.
- **Both swell gates pass only 9.5% of obs** — before wind, gust, and
  alignment checks remove more. A GO needs all of them to align at once.

The `≤ 5 ft` gate compares against the open-coast buoy's significant wave
height. But the actual Trinidad launch sits behind **Trinidad Head**, which
shelters it from NW swell (context.md: "sheltered in NW weather, dangerous in
W/S storms"). Using the full open-coast height for a sheltered launch
overstates conditions and biases the verdict to NO-GO.

## Goals

1. Raise the open-Pacific swell-height threshold from 5 ft → **6 ft** (the
   user's own documented upgrade path in thresholds.md).
2. Model Trinidad Head's lee so a sheltered trip gets a higher swell tolerance
   **only when the swell is actually from the NW** — physically correct, not a
   flat bonus that would mislead on W/S swell days.
3. Record newly acquired gear (Bixpy K-1 motor + 768 Wh battery) without
   relaxing any threshold.
4. Update the project convention now that the claude.ai side is retired:
   `reference/` is canonical and edited here, mirrored into `src/lib/config/`
   in the same commit.

## Non-goals

- No change to solo rules (both Trinidad zones remain not-solo, year 1).
- No Bixpy-driven threshold relaxation (motors/batteries fail; cold water
  destroys battery capacity — year-1 it is a bailout/get-home asset only).
- No automatic MWD-based directional discount (rejected as too implicit for
  year-1 calibration).
- No new exposure modeling for any launch other than Trinidad.
- No widening of the model beyond what is specified here.

## Design

### Exposure is a trip property, not a new launch

Both zones are the same physical launch (Indian Beach / Trinidad Harbor) —
identical buoy (46244), tide station, NWS zone (PZZ450), and species compat.
Only the swell-height tolerance differs. Therefore **no new `LaunchId`** (which
would ripple through every `Record<LaunchId, …>` map). Instead, an optional
trip parameter:

```ts
exposure?: 'lee' | 'open'   // default 'open' (conservative)
```

It is meaningful only for `openOcean` launches and ignored elsewhere.

### Single shared swell-height decision function

Swell-height evaluation is currently duplicated in three places, which is the
same split that produced the prior null-wave gap:

1. `runSafetyFromBuoy` — today / live-buoy day-card path
2. `runSafetyFromNws` — forecast day-card path
3. `evaluateNow` — the live "fish now" path (re-implements the guard ~line 194)

The lee logic lands in **one** helper in `runSafety.ts`, called by all three:

```
swellHeightCheck(heightFt, swellDirDeg, exposure, profile) -> Check
  limit = thresholds.swellHeightFt            // 6 ft (was 5)
  leeGranted = profile.openOcean
            && exposure === 'lee'
            && swellDirDeg != null
            && leeArc[0] <= swellDirDeg <= leeArc[1]   // [300, 340]
  if leeGranted: limit = thresholds.swellHeightLeeFt   // 7 ft
  status = evalAbove(heightFt, limit)
  note   = explains which limit applied and why:
             - "lee granted (NW swell, behind the Head)"
             - "lee denied: swell not from NW (300–340°)"
             - "lee denied: swell direction unknown — fail-closed to 6 ft"
```

**Fail-closed:** when `swellDirDeg` is null/undefined (e.g. forecast prose with
no swell direction), no bonus is granted → 6 ft applies. Period (≥ 10 s) and
wind/swell alignment (≤ 45°) are untouched and remain hard gates in both zones.

### Config (`src/lib/config/thresholds.ts`)

```ts
swellHeightFt: 6,            // was 5
swellHeightLeeFt: 7,        // new: Trinidad-Head lee, NW swell only
leeSwellArcDeg: [300, 340], // new: NW shelter arc (inclusive), degrees true
```

### Wiring

- **API** (`src/routes/api/verdict/+server.ts`): parse `exposure` query param,
  default `'open'`, validate against `'lee' | 'open'`, thread into
  `computeVerdict` → `runSafety` and into the `evaluateNow` path.
- **`computeVerdict` / `SafetyInput`**: add optional `exposure`, pass through.
- **UI** (`+page.svelte`): when Trinidad is the selected launch, show a
  lee / open-Pacific sub-toggle, defaulting to **open Pacific**. No toggle for
  other launches. Day cards render for the selected exposure.

### Reference + doc edits (same commit as code)

- `reference/thresholds.md`: swell 5 → 6 ft in the hard-no-go table; replace the
  stub "Trinidad protected up to 7 ft swell" note with the real lee rule
  (7 ft, swell from 300–340°, period and alignment unchanged). Mirror numbers
  into `thresholds.ts`.
- `reference/context.md`: move Bixpy from "Future Upgrade Path" and "Open
  Questions" into owned gear — **Bixpy K-1 motor + 768 Wh battery** — with an
  explicit "does not relax thresholds; year-1 bailout/get-home asset only" note.
- `CLAUDE.md`: drop the "reference/ is read-only / edited on claude.ai then
  mirrored back" convention; replace with "reference/ is canonical and edited
  here, mirrored into `src/lib/config/` in the same commit."

## Testing

- Unit tests for `swellHeightCheck`:
  - 5.9 ft / 6.1 ft boundary, exposure `open` → not-fail (warn) / fail.
    (Note: `evalAbove` has a 20% warn band, so 5.9 ft is `warn`, not `pass`;
    the assertion is fail vs not-fail at the 6 ft limit.)
  - 6.9 ft / 7.1 ft at 320°, exposure `lee` → not-fail (warn) / fail (lee
    granted, 7 ft limit).
  - 6.5 ft at 270° (W swell), exposure `lee` → fail (lee denied, 6 ft limit).
  - 6.5 ft with null direction, exposure `lee` → fail (fail-closed to 6 ft).
  - exposure `lee` on a non-ocean launch → ignored (6 ft / standard path).
- Regression: existing Trinidad tests updated for the 6 ft threshold.
- Agreement test: the same (height, direction, exposure) input yields the same
  swell-height verdict across the buoy, NWS, and "now" paths (proves the shared
  helper removed the drift risk).
- `npm test` green before commit.

## Rollout

Single feature branch `trinidad-lee-exposure`, one PR. Push to `main`
auto-deploys to https://humboldt.fish via the existing GitHub Actions pipeline.
