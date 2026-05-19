# Tide-aware Launch Windows — Design

**Date:** 2026-05-18
**Status:** Design (pre-implementation)
**Scope:** Mad River Slough + Humboldt Bay (interior) launches

---

## Problem

Today the launch-window logic in `src/lib/verdict/runLogistics.ts` builds three windows for tide-aware bay launches:

1. Morning window: civil dawn + 30 min → +4h cap
2. Evening window: civil dusk − 4h → civil dusk
3. Afternoon-slack window: when a slack event falls between 12:00–18:00 local

The morning and evening windows are purely twilight-driven. They do not consider tide phase. The Logistics layer separately surfaces a `Tidal currents` check with morning slack / flood peak / ebb peak times and the canonical guidance: *"Launch on the last 90 min of flood or at slack. Return before the ebb builds past 1.5 kt."*

That guidance never gets cross-checked against the recommended morning/evening windows. On a day where civil dawn lands during a 2.5 kt ebb, the app cheerfully suggests "launch at 06:30" while the tide chip below it says "launch on flood or slack." The user reconciles two independent pieces of advice.

The failure mode that motivates this fix: getting carried by a 2–3 kt ebb on the way home is the actual safety concern on Humboldt Bay (entrance channel proximity) and at Mad River Slough (mud bottom, low-water grounding). The windows shouldn't pretend the tide doesn't exist.

## Goals

- Cross-reference tide phase against existing dawn/dusk windows on tide-aware launches.
- Adjust `returnBy` when the ebb will build past a safe threshold during the trip.
- Suppress dawn/dusk windows when the tide constraint collapses them below a viable duration.
- Always surface slack-anchored alternative windows (morning + afternoon) so the user has a tide-friendly choice on any day where one exists.
- Preserve full user agency on the dawn/dusk windows when the tide is friendly — no change in behavior for tide-cooperative days.

## Non-goals

- No change to the four-layer verdict fail-stop logic. Tide-hostile windows are still windows, not Safety failures.
- No change to the open-ocean Trinidad pipeline or to the lagoon spit advisory.
- No species-aware threshold variation. Same thresholds for all species at the tide-aware launches.
- No "pick the single best window" ranking. All viable windows are surfaced.

## Decisions

| Decision | Choice |
|---|---|
| Ebb/flood asymmetry | **Asymmetric — ebb is the enemy.** Ebb > 1.5 kt demotes and clamps. Flood demotes (warn only) at > 3.0 kt. |
| Slack window trigger | **Always show available slack windows.** Morning slack (04:00–11:00 local) and afternoon slack (12:00–18:00, already implemented) appear whenever a slack falls in their range, regardless of dawn/dusk window health. |
| Short window handling | **2-hour minimum.** When the clamp shrinks a dawn/dusk window below 2h, suppress it entirely. Slack siblings carry the load. |
| Evening symmetry | **Same logic for morning and evening.** Same physics deserves same treatment. The 2h-minimum rule handles the suppress case cleanly. |
| Scope | Launches where `currentStation` is set: `mad-river-slough` (HUB0203), `humboldt-bay-interior` (HUB0203). |

## Architecture

All new logic lands in `src/lib/verdict/runLogistics.ts`. No new modules. The file grows from ~390 to ~500 lines; still a single-file responsibility (compute Logistics layer + windows).

### Type additions (`src/lib/types.ts`)

```ts
export interface TidePhaseAnnotation {
  phase: 'ebb' | 'flood' | 'slack' | 'mixed';
  peakSpeedKt: number;      // max |velocity_major| within [launchAt, returnBy]
  peakTimeLocal: string;    // "HH:MM PT"
  description: string;       // short prose for the UI chip
}

export interface LaunchWindow {
  // ...existing fields (label, launchAt, returnBy, checkInBy, rationale)
  tide?: TidePhaseAnnotation;
  warning?: string;
}
```

### New helpers in `runLogistics.ts`

**`annotateWindowWithTide(window, currents) → TidePhaseAnnotation`**
- Scans `currents.events` between window's `launchAt` and the **pre-clamp** `returnBy`. Annotation always describes the full natural window so the user sees why the clamp fired.
- Classifies dominant phase. If the window straddles a slack, phase = `'mixed'`.
- Finds peak `|velocity_major|` and its time within the pre-clamp range.
- Builds a description like `"flood building → slack 09:45 → ebb (peaks 2.4 kt at 11:20)"`.

**`clampReturnByForEbb(window, currents) → { returnBy, suppressed }`**
- Scans `currents.events` for the first ebb segment after `launchAt` where the interpolated speed crosses 1.5 kt building.
- If that time is earlier than the current `returnBy`, replace `returnBy` with `(crossingTime − 15 min)` to give buffer for the paddle home.
- If the resulting trip duration is < 2h, set `suppressed: true`. Caller drops the window.

**`addMorningSlackWindow(currents, date, sun) → LaunchWindow | null`**
- Symmetric counterpart to the existing afternoon-slack block.
- Hunts for slack events between 04:00 and 11:00 local on `date`.
- Window: `launchAt = slack − 30 min`, `returnBy = launchAt + 4h`, `checkInBy = returnBy + 1h`.
- Skipped if `launchAt` is before civil dawn (would be a predawn launch, which the thresholds discourage).

### Pipeline order in `runLogistics`

```
1. Build dawn/dusk windows (existing logic, unchanged)
2. Build morning + afternoon slack windows (afternoon existing; morning new)
3. If launch has currentStation AND data.tidalCurrents exists:
   a. For dawn/dusk windows:
      - annotateWindowWithTide() against the natural (pre-clamp) [launchAt, returnBy] range
      - clampReturnByForEbb() → drop if suppressed
      - Set warning if peak ebb |velocity| within the pre-clamp range > 1.5 kt
      - Else set warning if peak flood |velocity| within the pre-clamp range > 3.0 kt
   b. For slack-anchored windows:
      - annotateWindowWithTide() only (no clamp, no warning — they're slack-anchored by construction)
4. Existing "Tidal currents" Logistics check unchanged
```

### Missing-data behavior

- If `data.tidalCurrents` is null/missing → all annotation/clamp/morning-slack logic skipped. Windows render exactly like today.
- The existing `Tidal currents` Logistics check already sets status `'unknown'` with note "NOAA tidal-currents fetch failed; using tide-cycle planning only." That stays the visible signal that the windows aren't tide-checked.
- No silent fallback. No partial annotation when the dataset is incomplete.

## Verdict layer integration

The four-layer fail-stop logic is untouched.

- **Layer 1 Legal** — unaffected.
- **Layer 2 Safety** — unaffected. Currents don't promote a Logistics concern to a Safety failure. Bay interior remains "protected water" by definition. Entrance-channel proximity is covered by the existing "stay clear" rule documented in `launches.ts`, not by this logic.
- **Layer 3 Quality** — unaffected. Species-aware Quality tide guidance from commit `6093a00` is the right home for "bite is better on the turn" reasoning; not duplicated here.
- **Layer 4 Logistics** — gains annotated windows + possible warnings. Global `Tidal currents` check unchanged.

A demoted window stays a window. It just renders with ⚠ and possibly a shorter `returnBy`. The verdict status (`go` / `conditional` / `no-go`) is computed from the same inputs as today.

## UI rendering (`src/lib/components/DayCard.svelte`)

Each window already renders as a card-within-card. Two additions:

1. **Tide chip** — small, secondary-colored line under launch/return times, populated from `window.tide.description`. Always present on tide-aware launches when currents data is available.
   - Example: `"flood building → slack 09:45 → ebb (peaks 2.4 kt at 11:20)"`
2. **Warning badge** — ⚠ chip when `window.warning` is set. Warning-yellow color (match existing ⚠ chips). Same row as the per-window copy-to-clipboard button.
   - Ebb example: `"⚠ ebb peaks 2.4 kt at 07:30 — fight current on return"`
   - Flood example: `"⚠ flood peaks 3.4 kt at 06:30"`

Slack-anchored windows will usually have a neutral tide chip ("slack ~07:20, transitioning to flood") and no warning, by construction.

## Testing

Vitest unit tests in `tests/lib/verdict/runLogistics.test.ts`:

1. **Annotation: dawn during clean flood** — window covers a clean flood block. Tide chip describes flood building. No warning.
2. **Annotation: dawn during peak ebb** — window covers an ebb block peaking at 2.4 kt. Warning set with ebb peak time + magnitude. Return clamped before 1.5 kt crossing.
3. **Suppression: dawn collapses below 2h** — launch is already in 1.8 kt building ebb. Window suppressed; not in `windows` array. Morning slack window still present.
4. **No clamp on slack window** — afternoon slack window is annotated but never clamped, even if a subsequent ebb crosses 1.5 kt.
5. **Flood > 3.0 kt warning** — window covers a 3.4 kt flood peak. Warning set; no clamp.
6. **Missing currents data** — `data.tidalCurrents = undefined`. Windows match today's output exactly (no annotation, no clamp, no morning slack). Existing `Tidal currents` check still goes to `unknown`.
7. **Evening symmetric to morning** — evening window during an ebb block gets the same clamp + warning treatment as morning would.
8. **Trinidad / freshwater-lagoon** — `currentStation` absent; logic short-circuits; windows render as today.
9. **Lagoon launches (Big/Stone)** — `currentStation` absent; logic short-circuits.
10. **Up to 4 windows on tide-rich days** — morning + morning-slack + afternoon-slack + evening all present, all annotated.

Smoke test (`npm run smoke`) does not need changes — it validates fetcher schemas, not verdict logic.

## Open questions

None blocking. Resolved during brainstorming:

- Thresholds: 1.5 kt ebb (warn + clamp), 3.0 kt flood (warn only). User accepted lean B.
- Buffer before ebb crossing: 15 min (single value, not configurable). If this turns out wrong after real-world use, easy single-line change.

## Migration / rollout

- Zero migration. All new types are additive optional fields.
- No API surface change — the `LaunchWindow` interface gains optional fields, existing consumers ignore them.
- 218 existing tests must still pass.
- Deploy via existing CI on push to `main`.
