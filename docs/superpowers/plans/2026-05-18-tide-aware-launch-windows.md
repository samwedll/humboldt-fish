# Tide-aware Launch Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cross-reference live tidal currents against the dawn/dusk launch windows at `mad-river-slough` and `humboldt-bay-interior`, clamping return time when ebb will build past 1.5 kt and surfacing slack-anchored sibling windows so the user has a tide-friendly choice on any day.

**Architecture:** All new logic lives in `src/lib/verdict/runLogistics.ts` as three new exported helper functions (`annotateWindowWithTide`, `clampReturnByForEbb`, `buildMorningSlackWindow`) plus a small time-format helper in `src/lib/format.ts`. The `LaunchWindow` interface gains two optional fields (`tide`, `warning`). The Svelte UI gains a tide chip and a ⚠ badge. The four-layer verdict logic is untouched.

**Tech Stack:** TypeScript, SvelteKit 5 (runes), Vitest 4, Zod v4, Tailwind, Cloudflare Pages.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-18-tide-aware-launch-windows-design.md`.

---

## Constants used throughout

```ts
const EBB_WARN_KT = 1.5;      // ebb > this → warn + clamp returnBy
const FLOOD_WARN_KT = 3.0;    // flood > this → warn only (no clamp; flood at launch isn't the failure mode)
const CLAMP_BUFFER_MIN = 15;  // ebb-crossing time minus this gives clamped returnBy
const MIN_TRIP_HOURS = 2;     // clamped window shorter than this is suppressed
```

These constants are declared at the top of `src/lib/verdict/runLogistics.ts` alongside `BASE_GEAR`. Tests import them by name when asserting threshold behavior.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `TidePhaseAnnotation`; extend `LaunchWindow` with `tide?` and `warning?` |
| `src/lib/format.ts` | Modify | Add `toPacificLocalISO(d: Date): string` returning `"YYYY-MM-DDTHH:MM"` PT-local (the comparable form for `TidalCurrentEvent.time`) |
| `src/lib/verdict/runLogistics.ts` | Modify | Add 3 helper functions, the constants above, and wire them into the pipeline |
| `src/lib/components/DayCard.svelte` | Modify | Render `w.tide.description` as a chip; render `w.warning` as a ⚠ badge |
| `tests/lib/verdict/runLogistics.test.ts` | Modify | Unit tests for new helpers + integration tests for the pipeline wiring |
| `tests/lib/format.test.ts` | Create or modify | Unit test for `toPacificLocalISO` |

---

## Task 1: Time-format helper (foundation)

**Files:**
- Modify: `src/lib/format.ts`
- Create or modify: `tests/lib/format.test.ts`

The new helpers compare times to entries in `TidalCurrents.events`, whose `time` field is `"YYYY-MM-DDTHH:MM"` in Pacific local (LST/LDT). The existing `formatPacificTime` only returns `"HH:MM PT"`. We need a second helper that returns the comparable date+time form. String comparison on this form is correct because the format is fixed-width and chronologically sortable within the same time zone.

- [ ] **Step 1: Write the failing test**

Create or extend `tests/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toPacificLocalISO } from '../../src/lib/format.js';

describe('toPacificLocalISO', () => {
  it('returns YYYY-MM-DDTHH:MM in Pacific time (PDT)', () => {
    // 2026-05-18 12:51 UTC === 2026-05-18 05:51 PDT
    expect(toPacificLocalISO(new Date('2026-05-18T12:51:00Z'))).toBe('2026-05-18T05:51');
  });

  it('handles PST (winter)', () => {
    // 2026-01-15 16:30 UTC === 2026-01-15 08:30 PST
    expect(toPacificLocalISO(new Date('2026-01-15T16:30:00Z'))).toBe('2026-01-15T08:30');
  });

  it('rolls to prior day when UTC date is past midnight Pacific', () => {
    // 2026-05-18 02:00 UTC === 2026-05-17 19:00 PDT
    expect(toPacificLocalISO(new Date('2026-05-18T02:00:00Z'))).toBe('2026-05-17T19:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/format.test.ts`
Expected: FAIL — `toPacificLocalISO is not a function`.

- [ ] **Step 3: Implement `toPacificLocalISO` in `src/lib/format.ts`**

Append to `src/lib/format.ts`:

```ts
const PACIFIC_ISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

/**
 * Format a Date as "YYYY-MM-DDTHH:MM" Pacific local. This is the comparable
 * form for TidalCurrentEvent.time, which NOAA returns in station-local time
 * (LST/LDT). String comparison on this format is correct.
 *
 * Note: en-CA gives YYYY-MM-DD,HH:MM (with a literal comma); we split + rejoin.
 */
export function toPacificLocalISO(d: Date): string {
  const parts = PACIFIC_ISO.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // hour can come back as "24" at midnight under some locales; coerce to "00"
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/format.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `npm test`
Expected: PASS (existing 218 tests + 3 new = 221).

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts tests/lib/format.test.ts
git commit -m "Add toPacificLocalISO format helper"
```

---

## Task 2: Type additions

**Files:**
- Modify: `src/lib/types.ts`

Type-only commit. The new fields are optional, so existing test fixtures and consumers remain valid. This commit is verified by the compile-pass, not by a runtime test — the next task's tests will fail without these types.

- [ ] **Step 1: Add `TidePhaseAnnotation` and extend `LaunchWindow`**

In `src/lib/types.ts`, locate the `LaunchWindow` interface (around line 40) and replace it with:

```ts
export interface TidePhaseAnnotation {
  /** Dominant tide phase across the window. 'mixed' when the window straddles a slack. */
  phase: 'ebb' | 'flood' | 'slack' | 'mixed';
  /** Maximum |velocity_major| observed within the (pre-clamp) window, in knots. */
  peakSpeedKt: number;
  /** Type of the peak event ('ebb' or 'flood'). 'slack' when no peak event falls inside the window. */
  peakType: 'ebb' | 'flood' | 'slack';
  /** Time of peak speed, formatted as "HH:MM PT". */
  peakTimeLocal: string;
  /** Short human-readable summary for the UI chip. */
  description: string;
}

export interface LaunchWindow {
  label: string;        // "Morning", "Evening", "Around 13:11 slack", etc.
  launchAt: string;     // formatted local time, e.g. "05:51 PT"
  returnBy: string;     // formatted local time, e.g. "09:51 PT"
  checkInBy: string;    // returnBy + 1 hour — when shore contact should call USCG if no contact
  rationale?: string;   // short note explaining why this window
  tide?: TidePhaseAnnotation;  // populated on tide-aware launches when currents data is available
  warning?: string;            // populated when window is demoted (e.g. peak ebb in pre-clamp window > 1.5 kt)
}
```

- [ ] **Step 2: Verify compile passes**

Run: `npm run check`
Expected: 0 errors.

Run: `npm test`
Expected: PASS (221 tests). No new tests in this commit.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "Extend LaunchWindow with tide annotation + warning"
```

---

## Task 3: `annotateWindowWithTide` helper

**Files:**
- Modify: `src/lib/verdict/runLogistics.ts`
- Modify: `tests/lib/verdict/runLogistics.test.ts`

A pure function that takes a window range (Pacific-local ISO strings) and a `TidalCurrents` bundle and returns a `TidePhaseAnnotation`. It scans the events overlapping the range, identifies the dominant phase, finds peak |velocity|, and builds a human-readable description.

**Design notes for the implementer:**
- The `currents.events` array is sorted chronologically. Events occurring before `windowStart` or after `windowEnd` are out of scope, but the event **bracketing** `windowStart` matters too because the current at `windowStart` is mid-segment between two events.
- "Dominant phase" = the type (`ebb` or `flood`) that occupies the most clock time within `[windowStart, windowEnd]`. If a slack falls inside the window, `phase = 'mixed'`.
- `peakSpeedKt` = `max(|e.velocityKt|)` across all events whose `time` falls within `[windowStart, windowEnd]`. If no event falls inside (e.g. very short window between two events), use the larger |velocity| of the two bracketing events.
- `description` format examples:
  - Clean flood: `"flood building, peaks 2.1 kt at 11:22"`
  - Window straddling slack: `"flood → slack 09:45 → ebb (peaks 2.4 kt at 11:20)"`
  - Ebb-only: `"ebb (peaks 3.4 kt at 03:35), slack 07:28 follows"`

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/verdict/runLogistics.test.ts`, before the closing `})` of the file:

```ts
describe('annotateWindowWithTide', () => {
  const fixture = currentsFixture;

  it('window across a flood event: phase=flood, peak detected', () => {
    // 2026-05-17: slack 07:28, flood-peak 11:22 at 2.09 kt, slack 14:17.
    // Window 09:00–13:00 covers the rising-flood peak.
    const a = annotateWindowWithTide('2026-05-17T09:00', '2026-05-17T13:00', fixture);
    expect(a.phase).toBe('flood');
    expect(a.peakSpeedKt).toBeCloseTo(2.09, 2);
    expect(a.peakType).toBe('flood');
    expect(a.peakTimeLocal).toBe('11:22 PT');
    expect(a.description).toMatch(/flood/i);
    expect(a.description).toMatch(/2\.1 kt/);
  });

  it('window straddling a slack: phase=mixed', () => {
    // 2026-05-17: flood-peak 11:22, slack 14:17, ebb-peak 16:32 at -1.56.
    // Window 13:00–17:00 straddles the 14:17 slack. Ebb peak (1.56) is the
    // only non-slack event inside the window.
    const a = annotateWindowWithTide('2026-05-17T13:00', '2026-05-17T17:00', fixture);
    expect(a.phase).toBe('mixed');
    expect(a.peakSpeedKt).toBeCloseTo(1.56, 2);
    expect(a.peakType).toBe('ebb');
    expect(a.description).toMatch(/slack/i);
  });

  it('ebb-heavy morning window: phase=ebb, peak detected', () => {
    // 2026-05-18: slack 01:06, ebb-peak 04:14 at -3.34 kt, slack 08:12.
    // Window 03:00–07:00 covers ebb peak.
    const a = annotateWindowWithTide('2026-05-18T03:00', '2026-05-18T07:00', fixture);
    expect(a.phase).toBe('ebb');
    expect(a.peakSpeedKt).toBeCloseTo(3.34, 2);
    expect(a.peakType).toBe('ebb');
    expect(a.peakTimeLocal).toBe('04:14 PT');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t annotateWindowWithTide`
Expected: FAIL — `annotateWindowWithTide is not defined`.

- [ ] **Step 3: Import the new symbol at the top of the test file**

In `tests/lib/verdict/runLogistics.test.ts`, find the existing `runLogistics` import (around line 4) and change it to:

```ts
import {
  runLogistics,
  annotateWindowWithTide
} from '../../../src/lib/verdict/runLogistics.js';
```

- [ ] **Step 4: Implement `annotateWindowWithTide` in `runLogistics.ts`**

In `src/lib/verdict/runLogistics.ts`, near the existing `summarizeCurrents` (line 150), append:

```ts
const EBB_WARN_KT = 1.5;
const FLOOD_WARN_KT = 3.0;
const CLAMP_BUFFER_MIN = 15;
const MIN_TRIP_HOURS = 2;

/**
 * "HH:MM PT" formatted from a "YYYY-MM-DDTHH:MM" Pacific-local string.
 * Lives next to other helpers in this file so we don't ferry Date objects around.
 */
function ptIsoToHhmmLabel(iso: string): string {
  return `${iso.slice(11, 16)} PT`;
}

/**
 * Annotate a launch window with its dominant tide phase, peak current, and a
 * short prose summary suitable for a UI chip.
 *
 * windowStart / windowEnd are Pacific-local "YYYY-MM-DDTHH:MM" strings — the
 * same form as TidalCurrentEvent.time. String comparison is correct under that
 * format.
 */
export function annotateWindowWithTide(
  windowStart: string,
  windowEnd: string,
  currents: TidalCurrents
): import('../types.js').TidePhaseAnnotation {
  const events = currents.events;
  const inside = events.filter((e) => e.time >= windowStart && e.time <= windowEnd);

  // Determine phase. If a slack falls inside the window, the window crosses
  // a transition: phase = 'mixed'. Otherwise, find the bracketing flood/ebb
  // event by walking forward through events from windowStart.
  const slackInside = inside.find((e) => e.type === 'slack');
  let phase: 'ebb' | 'flood' | 'slack' | 'mixed';
  if (slackInside) {
    phase = 'mixed';
  } else {
    // Use the closest event whose time >= windowStart (the next inflection point);
    // its type tells us which segment we're in.
    const next = events.find((e) => e.time >= windowStart);
    if (next && next.type !== 'slack') {
      phase = next.type;
    } else {
      // Past all peaks, or next is a slack but no slack inside the window:
      // we're in the segment immediately before `next`, so the phase is the
      // opposite of the previous peak event's phase (well, the same as `next`'s
      // segment leading into it). Just fall back to the strongest |velocity|
      // event's type within or bracketing the window.
      const bracketing = [
        ...inside,
        ...events.filter((e) => e.time < windowStart).slice(-1),
        ...events.filter((e) => e.time > windowEnd).slice(0, 1)
      ];
      const strongest = bracketing.reduce((acc, e) =>
        Math.abs(e.velocityKt) > Math.abs(acc.velocityKt) ? e : acc,
        bracketing[0]
      );
      phase = strongest.type === 'slack' ? 'slack' : strongest.type;
    }
  }

  // Peak speed: max |velocity_major| among events inside the window. If none
  // are inside (very short window), fall back to the larger of the two
  // bracketing events.
  let peakEvent: TidalCurrentEvent | undefined = inside.reduce<TidalCurrentEvent | undefined>(
    (acc, e) => (!acc || Math.abs(e.velocityKt) > Math.abs(acc.velocityKt) ? e : acc),
    undefined
  );
  if (!peakEvent) {
    const before = events.filter((e) => e.time < windowStart).slice(-1)[0];
    const after = events.filter((e) => e.time > windowEnd)[0];
    peakEvent = [before, after]
      .filter((e): e is TidalCurrentEvent => e !== undefined)
      .reduce<TidalCurrentEvent | undefined>(
        (acc, e) => (!acc || Math.abs(e.velocityKt) > Math.abs(acc.velocityKt) ? e : acc),
        undefined
      );
  }
  const peakSpeedKt = peakEvent ? Math.abs(peakEvent.velocityKt) : 0;
  const peakType: 'ebb' | 'flood' | 'slack' = peakEvent ? peakEvent.type : 'slack';
  const peakTimeLocal = peakEvent ? ptIsoToHhmmLabel(peakEvent.time) : ptIsoToHhmmLabel(windowStart);

  // Description. Build in a few canonical shapes based on phase + events.
  let description: string;
  if (phase === 'mixed') {
    const slack = inside.find((e) => e.type === 'slack')!;
    const peak = inside.find((e) => e.type !== 'slack');
    if (peak) {
      const earlierPhase = peak.time < slack.time ? peak.type : (peak.type === 'flood' ? 'ebb' : 'flood');
      const laterPhase = earlierPhase === 'flood' ? 'ebb' : 'flood';
      description = `${earlierPhase} → slack ${slack.time.slice(11, 16)} → ${laterPhase} (peaks ${peakSpeedKt.toFixed(1)} kt at ${peak.time.slice(11, 16)})`;
    } else {
      description = `slack ${slack.time.slice(11, 16)} mid-window`;
    }
  } else if (phase === 'flood') {
    description = `flood building, peaks ${peakSpeedKt.toFixed(1)} kt at ${peakTimeLocal.replace(' PT', '')}`;
  } else if (phase === 'ebb') {
    description = `ebb (peaks ${peakSpeedKt.toFixed(1)} kt at ${peakTimeLocal.replace(' PT', '')})`;
  } else {
    description = `slack`;
  }

  return { phase, peakSpeedKt, peakType, peakTimeLocal, description };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t annotateWindowWithTide`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: PASS (224 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/verdict/runLogistics.ts tests/lib/verdict/runLogistics.test.ts
git commit -m "Add annotateWindowWithTide helper"
```

---

## Task 4: `clampReturnByForEbb` helper

**Files:**
- Modify: `src/lib/verdict/runLogistics.ts`
- Modify: `tests/lib/verdict/runLogistics.test.ts`

A pure function that takes a window range and a `TidalCurrents` bundle and returns the clamped `windowEnd` (an ISO string) plus a `suppressed` flag. The clamp fires when an ebb event within or shortly after the window peaks above `EBB_WARN_KT`. We use linear interpolation between the preceding slack (0 kt at `slack.time`) and the ebb peak to estimate when |velocity| first crosses 1.5 kt building. Subtract `CLAMP_BUFFER_MIN` to give paddle-home buffer.

If the resulting clamped duration is shorter than `MIN_TRIP_HOURS`, the helper returns `{ suppressed: true }`. The caller drops the window.

**Edge cases the implementer must handle:**
- No ebb event after `windowStart`: return original `windowEnd`, `suppressed: false`.
- Next ebb after `windowStart` is below `EBB_WARN_KT`: same.
- The 1.5 kt crossing is **after** `windowEnd`: original `windowEnd`, `suppressed: false`.
- The crossing is before `windowStart`: launch already in hostile ebb. Return `{ suppressed: true }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/verdict/runLogistics.test.ts`, before the closing of the previous `describe` block:

```ts
describe('clampReturnByForEbb', () => {
  const fixture = currentsFixture;

  it('no ebb above threshold inside or just after window: no clamp', () => {
    // 2026-05-17 afternoon: slack 14:17, ebb-peak 16:32 at -1.56 kt (just over
    // 1.5 kt). Window 09:00–13:00 sits before this. Window end is 13:00 — well
    // before the ebb crosses 1.5 kt around 16:25-ish. No clamp.
    const r = clampReturnByForEbb('2026-05-17T09:00', '2026-05-17T13:00', fixture);
    expect(r.suppressed).toBe(false);
    expect(r.newEnd).toBe('2026-05-17T13:00');
  });

  it('ebb-heavy afternoon: clamps before threshold crossing (≥ 2h trip remaining)', () => {
    // Synthetic fixture with a soft ebb so the clamp leaves more than 2h:
    // slack 13:00 → ebb-peak 17:30 at -1.8 kt → slack 20:00.
    // Window 13:30 → 17:30. Linear-interp 1.5 kt crossing:
    //   13:00 + (1.5/1.8) * 270 min = 13:00 + 225 min = 16:45.
    // Clamped end = 16:45 - 15 min buffer = 16:30. Trip = 13:30 → 16:30 = 3h.
    const synth: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T13:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T17:30', type: 'ebb', velocityKt: -1.8, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T20:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const r = clampReturnByForEbb('2026-05-18T13:30', '2026-05-18T17:30', synth);
    expect(r.suppressed).toBe(false);
    expect(r.newEnd).toBe('2026-05-18T16:30');
  });

  it('window collapses below 2h: suppressed', () => {
    // 2026-05-21 fixture: slack 03:29 → ebb-peak 06:30 at -2.47 → slack 10:42.
    // Window 04:00 → 08:00. Crossing 1.5 kt at ~05:19 building. Clamped end
    // 05:04. Trip 04:00 → 05:04 = 1h4m. Below 2h → suppress.
    const r = clampReturnByForEbb('2026-05-21T04:00', '2026-05-21T08:00', fixture);
    expect(r.suppressed).toBe(true);
  });

  it('launch already in hostile ebb: suppressed', () => {
    // 2026-05-18 ebb peak 04:14 at -3.34. Launch at 04:00 is mid-ebb (already
    // above 1.5 kt). Suppress.
    const r = clampReturnByForEbb('2026-05-18T04:00', '2026-05-18T08:00', fixture);
    expect(r.suppressed).toBe(true);
  });
});
```

**Note:** Test 2 above also adds a `TidalCurrents` import; ensure your test file imports the type:

```ts
import type { FetchedData, TidalCurrents } from '../../../src/lib/types.js';
```

(The existing test file already imports `TidalCurrents` near the top — no change needed if it's there.)

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t clampReturnByForEbb`
Expected: FAIL — `clampReturnByForEbb is not defined`.

- [ ] **Step 3: Import the new symbol in the test file**

Extend the import:

```ts
import {
  runLogistics,
  annotateWindowWithTide,
  clampReturnByForEbb
} from '../../../src/lib/verdict/runLogistics.js';
```

- [ ] **Step 4: Implement `clampReturnByForEbb` in `runLogistics.ts`**

Append below `annotateWindowWithTide`:

```ts
/**
 * Convert "YYYY-MM-DDTHH:MM" Pacific-local string to integer minutes since
 * epoch-of-Jan-1-2000-Pacific. We never compare across DST boundaries with
 * this; we only diff within a single day, so a simple minute count from a
 * fixed date works without any timezone math.
 *
 * For multi-day windows (shouldn't happen here, since launch windows are
 * always within the same calendar day), this would need fixing.
 */
function ptIsoToMinutes(iso: string): number {
  const [datePart, timePart] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  // Days since 2000-01-01 + hours + minutes. Approximate but consistent.
  const daysSince2000 =
    (y - 2000) * 365 + Math.floor((y - 2000) / 4) + (m - 1) * 31 + (d - 1);
  return daysSince2000 * 1440 + hh * 60 + mm;
}

function minutesToPtIso(totalMinutes: number, referenceDate: string): string {
  // referenceDate is "YYYY-MM-DD" — used to anchor the output to the same day
  // (windows always stay within one day).
  const [y, m, d] = referenceDate.split('-').map(Number);
  const refMin = ptIsoToMinutes(`${referenceDate}T00:00`);
  const dayMin = totalMinutes - refMin;
  const hh = Math.floor(dayMin / 60);
  const mm = dayMin % 60;
  return `${referenceDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Clamp returnBy so the trip ends before ebb builds past EBB_WARN_KT. Linear
 * interpolation between the preceding slack and the ebb peak gives a defensible
 * crossing-time estimate; subtract CLAMP_BUFFER_MIN for paddle-home margin.
 *
 * Returns:
 *   - { suppressed: false, newEnd: <ISO> } if no clamp or clamp leaves ≥ MIN_TRIP_HOURS
 *   - { suppressed: true } if the window is shorter than MIN_TRIP_HOURS post-clamp,
 *     OR if launch is already in hostile ebb.
 */
export function clampReturnByForEbb(
  windowStart: string,
  windowEnd: string,
  currents: TidalCurrents
): { newEnd: string; suppressed: boolean } {
  const events = currents.events;

  // Find the first ebb event whose time is >= windowStart and whose magnitude
  // exceeds the threshold. We also need its preceding slack to interpolate.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== 'ebb' || Math.abs(e.velocityKt) <= EBB_WARN_KT) continue;
    if (e.time < windowStart) {
      // Ebb peak is before window start. If the preceding slack is also before
      // windowStart, launch may already be in hostile ebb. Look at the next
      // slack: if windowStart is between slack(before)=this_slack and the
      // peak, current is rising in ebb. If windowStart is past the peak, ebb
      // is decreasing — check the next slack after peak.
      const prevSlack = events.slice(0, i).reverse().find((p) => p.type === 'slack');
      const nextSlack = events.slice(i + 1).find((p) => p.type === 'slack');
      if (!prevSlack || !nextSlack) continue;
      if (windowStart >= prevSlack.time && windowStart <= nextSlack.time) {
        // Linear interp |velocity|: triangle peaks at e.time at |velocity| = |e.velocityKt|.
        const launchVel = interpEbbMagnitude(windowStart, prevSlack.time, e.time, nextSlack.time, Math.abs(e.velocityKt));
        if (launchVel > EBB_WARN_KT) return { suppressed: true, newEnd: windowEnd };
      }
      continue;
    }
    // e.time >= windowStart. Determine ebb-segment bounds.
    const prevSlack = events.slice(0, i).reverse().find((p) => p.type === 'slack');
    if (!prevSlack) continue;

    // Crossing time: linear interpolation between prevSlack (0 kt) and peak (e.velocityKt).
    // |v|(t) = |peak| * (t - slack) / (peak - slack), assuming we're still on the rising side.
    const slackMin = ptIsoToMinutes(prevSlack.time);
    const peakMin = ptIsoToMinutes(e.time);
    const startMin = ptIsoToMinutes(windowStart);
    const endMin = ptIsoToMinutes(windowEnd);

    // Crossing on the rising side (slack → peak).
    let crossingMin: number | null = null;
    if (startMin >= slackMin && startMin <= peakMin) {
      // Launch is between slack and peak (already in rising ebb if past slack).
      const launchVel = (Math.abs(e.velocityKt) * (startMin - slackMin)) / (peakMin - slackMin);
      if (launchVel > EBB_WARN_KT) return { suppressed: true, newEnd: windowEnd };
    }
    if (startMin <= peakMin && endMin >= slackMin) {
      // Could cross during the rising side.
      const t = slackMin + ((peakMin - slackMin) * EBB_WARN_KT) / Math.abs(e.velocityKt);
      if (t >= startMin && t <= endMin) crossingMin = t;
    }
    if (crossingMin === null) {
      // Threshold not crossed in this window — keep going (a later, stronger ebb may cross).
      continue;
    }
    const clampedEndMin = crossingMin - CLAMP_BUFFER_MIN;
    if (clampedEndMin <= startMin || (clampedEndMin - startMin) < MIN_TRIP_HOURS * 60) {
      return { suppressed: true, newEnd: windowEnd };
    }
    const dateRef = windowStart.slice(0, 10);
    return { newEnd: minutesToPtIso(clampedEndMin, dateRef), suppressed: false };
  }

  // No hostile ebb encountered.
  return { newEnd: windowEnd, suppressed: false };
}

function interpEbbMagnitude(
  t: string,
  slackBefore: string,
  peak: string,
  slackAfter: string,
  peakMag: number
): number {
  const tMin = ptIsoToMinutes(t);
  const slackBeforeMin = ptIsoToMinutes(slackBefore);
  const peakMin = ptIsoToMinutes(peak);
  const slackAfterMin = ptIsoToMinutes(slackAfter);
  if (tMin <= peakMin) {
    return (peakMag * (tMin - slackBeforeMin)) / (peakMin - slackBeforeMin);
  } else {
    return (peakMag * (slackAfterMin - tMin)) / (slackAfterMin - peakMin);
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t clampReturnByForEbb`
Expected: PASS (4 tests).

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: PASS (228 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/verdict/runLogistics.ts tests/lib/verdict/runLogistics.test.ts
git commit -m "Add clampReturnByForEbb helper"
```

---

## Task 5: `buildMorningSlackWindow` helper

**Files:**
- Modify: `src/lib/verdict/runLogistics.ts`
- Modify: `tests/lib/verdict/runLogistics.test.ts`

Symmetric counterpart to the existing afternoon-slack-window block. Hunts for a slack event between 04:00 and 11:00 local on `date`. If found, builds a window with `launchAt = slack − 30 min`, `returnBy = launchAt + 4h`, `checkInBy = returnBy + 1h`. Returns `null` when no slack falls in the range, or when the proposed `launchAt` is before `civilDawn`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/verdict/runLogistics.test.ts` after the `clampReturnByForEbb` describe block:

```ts
describe('buildMorningSlackWindow', () => {
  const civilDawn = new Date('2026-05-18T12:30:00Z'); // 05:30 PT

  it('returns a window when a slack falls between 04:00 and 11:00 local', () => {
    // 2026-05-18: slack 08:12.
    const w = buildMorningSlackWindow(currentsFixture, '2026-05-18', civilDawn);
    expect(w).not.toBeNull();
    expect(w!.label).toMatch(/slack/i);
    expect(w!.launchAt).toBe('07:42 PT'); // 08:12 − 30 min
    expect(w!.returnBy).toBe('11:42 PT');  // 07:42 + 4h
    expect(w!.checkInBy).toBe('12:42 PT'); // returnBy + 1h
  });

  it('returns null when proposed launch is before civil dawn', () => {
    // Slack 03:25-ish doesn't exist on 2026-05-18 — fabricate a fixture.
    const synthetic: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T05:45', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    // launchAt would be 05:15 — civilDawn is 05:30. Reject.
    const w = buildMorningSlackWindow(synthetic, '2026-05-18', civilDawn);
    expect(w).toBeNull();
  });

  it('returns null when no slack in 04:00–11:00 local', () => {
    const synthetic: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T13:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const w = buildMorningSlackWindow(synthetic, '2026-05-18', civilDawn);
    expect(w).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t buildMorningSlackWindow`
Expected: FAIL — `buildMorningSlackWindow is not defined`.

- [ ] **Step 3: Import the new symbol in the test file**

Extend the import:

```ts
import {
  runLogistics,
  annotateWindowWithTide,
  clampReturnByForEbb,
  buildMorningSlackWindow
} from '../../../src/lib/verdict/runLogistics.js';
```

- [ ] **Step 4: Add `toPacificLocalISO` to the imports at the top of `runLogistics.ts`**

At the top of `src/lib/verdict/runLogistics.ts`, find the existing `import { formatPacificTime } from '../format.js';` and change it to:

```ts
import { formatPacificTime, toPacificLocalISO } from '../format.js';
```

Also add `LaunchWindow` to the `types.js` import if not already there.

- [ ] **Step 5: Implement `buildMorningSlackWindow` in `runLogistics.ts`**

Append below `clampReturnByForEbb`:

```ts
/**
 * Build a slack-anchored morning launch window. Symmetric counterpart to the
 * existing afternoon-slack block in runLogistics. Looks for a slack in
 * 04:00–11:00 Pacific local on `date`. Skips if the proposed launchAt would
 * be before civilDawn.
 */
export function buildMorningSlackWindow(
  currents: TidalCurrents,
  date: string,
  civilDawn: Date
): LaunchWindow | null {
  const morningSlack = currents.events.find(
    (e) => e.type === 'slack' && e.time.startsWith(date) && hourOf(e.time) >= 4 && hourOf(e.time) <= 11
  );
  if (!morningSlack) return null;

  const launchAtIso = shiftPtIso(morningSlack.time, -30);
  const civilDawnIso = toPacificLocalISO(civilDawn);
  if (launchAtIso < civilDawnIso) return null;

  const launchAt = `${launchAtIso.slice(11, 16)} PT`;
  const returnByIso = shiftPtIso(launchAtIso, 4 * 60);
  const returnBy = `${returnByIso.slice(11, 16)} PT`;
  const checkInByIso = shiftPtIso(returnByIso, 60);
  const checkInBy = `${checkInByIso.slice(11, 16)} PT`;

  return {
    label: `Around ${morningSlack.time.slice(11, 16)} slack`,
    launchAt,
    returnBy,
    checkInBy,
    rationale:
      'Tide-driven — launch ~30 min before slack, fish through the turn, return on the building tide.'
  };
}

/** Shift a "YYYY-MM-DDTHH:MM" PT-local string by N minutes (positive or negative). */
function shiftPtIso(iso: string, deltaMinutes: number): string {
  const totalMin = ptIsoToMinutes(iso) + deltaMinutes;
  return minutesToPtIso(totalMin, iso.slice(0, 10));
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t buildMorningSlackWindow`
Expected: PASS (3 tests).

- [ ] **Step 7: Run full suite**

Run: `npm test`
Expected: PASS (231 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/verdict/runLogistics.ts tests/lib/verdict/runLogistics.test.ts
git commit -m "Add buildMorningSlackWindow helper"
```

---

## Task 6: Wire helpers into `runLogistics` pipeline

**Files:**
- Modify: `src/lib/verdict/runLogistics.ts`
- Modify: `tests/lib/verdict/runLogistics.test.ts`

Three pipeline changes inside `runLogistics`:
1. For each dawn/dusk window on a tide-aware launch with currents data: annotate (using pre-clamp range), clamp returnBy, drop if suppressed, set warning based on pre-clamp peaks.
2. For the existing afternoon-slack window block: annotate only.
3. Add the morning-slack window via `buildMorningSlackWindow` (also annotated).

- [ ] **Step 1: Write the failing integration tests**

Append to `tests/lib/verdict/runLogistics.test.ts` in the `describe('runLogistics — multiple launch windows', ...)` block:

```ts
it('bay launch with clean flood morning: window has tide annotation, no warning, no clamp', () => {
  // Synthetic: morning has slack at 08:00 then flood-peak at 12:00 at 1.8 kt.
  // Civil dawn 05:30 PT → launch 06:00 PT. Window 06:00–10:00 spans rising
  // flood from slack at low magnitude (~0.7 kt at 09:00). No warning. No clamp.
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-18',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun2026_05_18, {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T08:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T12:00', type: 'flood', velocityKt: 1.8, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T15:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    })
  });
  const morning = r.recommendations.windows!.find((w) => w.label === 'Morning');
  expect(morning).toBeDefined();
  expect(morning!.tide).toBeDefined();
  expect(morning!.warning).toBeUndefined();
  // civilDawn 05:30 PT → launch 06:00 PT → returnBy 10:00 PT. No clamp.
  expect(morning!.returnBy).toBe('10:00 PT');
});

it('bay launch with ebb-heavy morning: window has warning + clamped returnBy', () => {
  // Use real fixture date 2026-05-21: slack 03:29, ebb-peak 06:30 at -2.47.
  // Civil dawn pinned to 05:30 PT via sun fixture.
  const sun2026_05_21 = {
    byDate: {
      '2026-05-21': {
        civilDawn: '2026-05-21T12:30:00Z',
        sunrise: '2026-05-21T13:05:00Z',
        sunset: '2026-05-22T03:30:00Z',
        civilDusk: '2026-05-22T04:00:00Z'
      }
    }
  };
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-21',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun2026_05_21, currentsFixture)
  });
  const morning = r.recommendations.windows!.find((w) => w.label === 'Morning');
  // Launch is 06:00 PT, already in rising ebb. Should be suppressed.
  // Slack at 03:29; peak -2.47 at 06:30. At 06:00, |v| = 2.47 * (151/181) = 2.06 kt > 1.5.
  // Suppress.
  expect(morning).toBeUndefined();
});

it('bay launch tide-rich day: up to 4 windows surfaced', () => {
  // Synthetic fixture: morning slack 07:30 (in 04-11 range) and afternoon
  // slack 13:00 (in 12-18 range). Tides are gentle so neither dawn nor dusk
  // window is suppressed. Afternoon-slack finder uses `.find()` and picks
  // the FIRST 12-18 slack — that's 13:00, not 17:00.
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-18',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun2026_05_18, {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T07:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T10:00', type: 'flood', velocityKt: 1.2, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T13:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T15:30', type: 'ebb', velocityKt: -1.0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T19:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    })
  });
  const labels = r.recommendations.windows!.map((w) => w.label);
  expect(labels).toContain('Morning');
  expect(labels).toContain('Evening');
  expect(labels.some((l) => /07:30 slack/i.test(l))).toBe(true);
  expect(labels.some((l) => /13:00 slack/i.test(l))).toBe(true);
  expect(r.recommendations.windows!.length).toBe(4);
});

it('slack-anchored windows are annotated but never warned', () => {
  // Reuse the same tide-rich fixture as above.
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-18',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun2026_05_18, {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T07:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T10:00', type: 'flood', velocityKt: 1.2, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T13:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T15:30', type: 'ebb', velocityKt: -1.0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T17:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    })
  });
  const slack = r.recommendations.windows!.find((w) => /slack/i.test(w.label));
  expect(slack).toBeDefined();
  expect(slack!.tide).toBeDefined();
  expect(slack!.warning).toBeUndefined();
});

it('Trinidad: no tide annotation on its windows (no currentStation)', () => {
  const r = runLogistics({
    species: 'rockfish',
    date: '2026-05-17',
    launch: 'trinidad',
    data: dataWith(sun2026_05_18, currentsFixture)
  });
  for (const w of r.recommendations.windows!) {
    expect(w.tide).toBeUndefined();
    expect(w.warning).toBeUndefined();
  }
});

it('bay launch flood > 3.0 kt: window gets flood warning but no clamp', () => {
  // Synthetic flood that peaks above 3.0 kt during the dusk window.
  const sun = {
    byDate: {
      '2026-05-18': {
        civilDawn: '2026-05-18T12:30:00Z',  // 05:30 PT
        sunrise: '2026-05-18T13:05:00Z',
        sunset: '2026-05-19T03:30:00Z',
        civilDusk: '2026-05-19T04:00:00Z'   // 21:00 PT
      }
    }
  };
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-18',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun, {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        // Evening window is 17:00–21:00. Strong flood peak inside.
        { time: '2026-05-18T16:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T19:00', type: 'flood', velocityKt: 3.4, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T22:00', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    })
  });
  const evening = r.recommendations.windows!.find((w) => w.label === 'Evening');
  expect(evening).toBeDefined();
  expect(evening!.warning).toMatch(/flood/i);
  expect(evening!.warning).toMatch(/3\.4 kt/);
  // No clamp on flood — returnBy unchanged.
  expect(evening!.returnBy).toBe('21:00 PT');
});

it('evening window symmetric to morning: demoted + clamped on a soft late ebb', () => {
  // Evening window: 17:00–21:00. Soft ebb peaks INSIDE the window so annotation
  // catches it, but the threshold crossing is late enough that the clamp leaves
  // > 2h trip (demote + clamp, NOT suppress).
  //
  // Slack 16:30 → ebb-peak 20:30 at -1.8 kt → slack 22:30.
  // Slack-to-peak ramp: 240 min. 1.5-kt crossing: 16:30 + (1.5/1.8)*240 = 19:50.
  // Clamped end: 19:50 − 15 min = 19:35. Trip 17:00 → 19:35 = 2h35m (> 2h).
  const sun = {
    byDate: {
      '2026-05-18': {
        civilDawn: '2026-05-18T12:30:00Z',
        sunrise: '2026-05-18T13:05:00Z',
        sunset: '2026-05-19T03:30:00Z',
        civilDusk: '2026-05-19T04:00:00Z'
      }
    }
  };
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-18',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun, {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T16:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T20:30', type: 'ebb', velocityKt: -1.8, meanFloodDirDeg: 21, meanEbbDirDeg: 197 },
        { time: '2026-05-18T22:30', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    })
  });
  const evening = r.recommendations.windows!.find((w) => w.label === 'Evening');
  expect(evening).toBeDefined();
  expect(evening!.warning).toMatch(/ebb/i);
  expect(evening!.warning).toMatch(/1\.8 kt/);
  // Clamp pushed returnBy in from 21:00 to 19:35.
  expect(evening!.returnBy).toBe('19:35 PT');
});

it('Big Lagoon: no tide annotation even with currents data (no currentStation)', () => {
  const r = runLogistics({
    species: 'cutthroat',
    date: '2026-05-17',
    launch: 'big-lagoon',
    data: dataWith(sun2026_05_18, currentsFixture)
  });
  for (const w of r.recommendations.windows!) {
    expect(w.tide).toBeUndefined();
    expect(w.warning).toBeUndefined();
  }
});

it('bay launch with currents missing: windows match today (no tide, no warning, no morning-slack)', () => {
  const r = runLogistics({
    species: 'surfperch',
    date: '2026-05-18',
    launch: 'humboldt-bay-interior',
    data: dataWith(sun2026_05_18, null)
  });
  for (const w of r.recommendations.windows!) {
    expect(w.tide).toBeUndefined();
    expect(w.warning).toBeUndefined();
  }
  expect(r.recommendations.windows!.length).toBe(2); // Morning + Evening only
});
```

**Note on dates in the above tests:** `dataWith(sun2026_05_18, ...)` uses 2026-05-18 sun times. The `civilDawn: '2026-05-18T12:30:00Z'` is 05:30 PT. Morning window `launchAt` = 06:00 PT (`05:30 + 30 min`); `returnBy` = 10:00 PT — but `formatPacificTime` may differ by 1 min from the off-by-one round, so adjust the exact-match assertion accordingly if needed. The tests that check `expect(morning!.returnBy).toBe('09:30 PT')` should be updated if the existing code rounds differently — match the rounding the existing test on line ~337 produces.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t "tide annotation|ebb-heavy|tide-rich|annotated but never warned|no tide annotation|currents missing"`
Expected: FAIL — windows lack `tide` / `warning` fields, or 3-window count instead of 4.

- [ ] **Step 3: Wire helpers into `runLogistics`**

In `src/lib/verdict/runLogistics.ts`, locate the windows-construction block (currently around lines 320–371). Replace the block from the `// Afternoon slack window` comment through the end of the slack-window construction with:

```ts
  // ============================================================
  // Slack-anchored windows + tide annotation + clamp
  // ============================================================

  // 1. Build morning + afternoon slack windows when available.
  if (launchProfile.currentStation && data.tidalCurrents && sun) {
    const civilDawn = new Date(sun.civilDawn);
    const morningSlack = buildMorningSlackWindow(data.tidalCurrents, date, civilDawn);
    if (morningSlack) windows.push(morningSlack);

    // Afternoon slack window (existing behavior, kept).
    const slacks = data.tidalCurrents.events.filter(
      (e) => e.type === 'slack' && e.time.startsWith(date)
    );
    const afternoonSlack = slacks.find((e) => {
      const hr = Number(e.time.slice(11, 13));
      return hr >= 12 && hr < 18;
    });
    if (afternoonSlack) {
      windows.push({
        label: `Around ${fmtTime(afternoonSlack.time)} slack`,
        launchAt: shiftPacificTime(afternoonSlack.time, -30),
        returnBy: shiftPacificTime(afternoonSlack.time, -30 + 4 * 60),
        checkInBy: shiftPacificTime(afternoonSlack.time, -30 + 5 * 60),
        rationale: 'Tide-driven — launch ~30 min before slack, fish through the turn, return on the building tide.'
      });
    }
  }

  // 2. Annotate dawn/dusk windows + clamp returnBy + set warnings.
  if (launchProfile.currentStation && data.tidalCurrents) {
    const annotated: LaunchWindow[] = [];
    for (const w of windows) {
      const isSlackAnchored = /slack/i.test(w.label);

      // Reconstruct the window's [launchStart, launchEnd] as Pacific-local ISO.
      const launchIso = `${date}T${w.launchAt.slice(0, 5)}`;
      const returnIso = `${date}T${w.returnBy.slice(0, 5)}`;

      // Annotate against the pre-clamp range.
      const tide = annotateWindowWithTide(launchIso, returnIso, data.tidalCurrents);
      const annotatedW: LaunchWindow = { ...w, tide };

      if (isSlackAnchored) {
        // No clamp, no warning for slack-anchored.
        annotated.push(annotatedW);
        continue;
      }

      // Pre-clamp warning check: drive off peakType (which peak is INSIDE the
      // window), not phase (the dominant phase). A mixed window has at most
      // one non-slack peak inside, so peakType correctly identifies it.
      if (tide.peakType === 'ebb' && tide.peakSpeedKt > EBB_WARN_KT) {
        annotatedW.warning = `ebb peaks ${tide.peakSpeedKt.toFixed(1)} kt at ${tide.peakTimeLocal.replace(' PT', '')} — return through building current`;
      } else if (tide.peakType === 'flood' && tide.peakSpeedKt > FLOOD_WARN_KT) {
        annotatedW.warning = `flood peaks ${tide.peakSpeedKt.toFixed(1)} kt at ${tide.peakTimeLocal.replace(' PT', '')} — control trade-off on assist`;
      }

      // Clamp returnBy + suppress check.
      const clamp = clampReturnByForEbb(launchIso, returnIso, data.tidalCurrents);
      if (clamp.suppressed) continue; // drop this window
      if (clamp.newEnd !== returnIso) {
        const newReturnHhmm = `${clamp.newEnd.slice(11, 16)} PT`;
        annotatedW.returnBy = newReturnHhmm;
        const newCheckMinutes = ptIsoToMinutes(clamp.newEnd) + 60;
        const newCheckIso = minutesToPtIso(newCheckMinutes, date);
        annotatedW.checkInBy = `${newCheckIso.slice(11, 16)} PT`;
      }

      annotated.push(annotatedW);
    }
    // Replace windows with the annotated/clamped/filtered list.
    windows.length = 0;
    windows.push(...annotated);
  }
```

Make sure to remove the old `// Afternoon slack window for tide-aware launches...` block (lines ~354–371 in the existing file) so the slack-window logic isn't run twice. Also add `LaunchWindow` to the type import at the top of the file if not present.

- [ ] **Step 4: Run failing tests to verify pass**

Run: `npx vitest run tests/lib/verdict/runLogistics.test.ts -t "tide annotation|ebb-heavy|tide-rich|annotated but never warned|no tide annotation|currents missing"`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS (237 tests). Some pre-existing tests may need their assertions updated if window counts on tide-rich days changed (the existing `Mad River Slough with afternoon slack data: 3 windows` test may now expect 4 if the synthetic fixture includes a morning slack — but the fixture in that test only includes 4 events with no morning slack in 04:00–11:00, so it should still be 3).

If any pre-existing test fails because of an exact count or label-match change, update its assertion to match the new behavior — but verify the new behavior is actually intended before doing so. The pre-existing afternoon-slack-only test must still pass without modification.

- [ ] **Step 6: Commit**

```bash
git add src/lib/verdict/runLogistics.ts tests/lib/verdict/runLogistics.test.ts
git commit -m "Wire tide annotation + clamp + warnings into launch windows"
```

---

## Task 7: DayCard UI — tide chip + warning badge

**Files:**
- Modify: `src/lib/components/DayCard.svelte`

Render `w.tide.description` as a small secondary-colored line under the launch/return times. Render `w.warning` as a yellow ⚠ chip in the same row as the existing copy button. Slack-anchored windows show the chip but generally not the warning.

This task has no Vitest test (DayCard is Svelte UI). Validate manually by running `npm run dev`. Visual confirmation is the test.

- [ ] **Step 1: Modify the window-rendering block in `DayCard.svelte`**

In `src/lib/components/DayCard.svelte`, locate the window-card block (around lines 138–157) and replace it with:

```svelte
{#each verdict.recommendations.windows as w}
  <div class="rounded bg-neutral-50 p-3 text-sm">
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1">
        <strong>{w.label}:</strong> Launch {w.launchAt}, return by {w.returnBy}
        {#if w.tide}
          <div class="mt-1 text-xs text-sky-700">🌊 {w.tide.description}</div>
        {/if}
        {#if w.warning}
          <div class="mt-1 inline-block rounded border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-900">
            ⚠ {w.warning}
          </div>
        {/if}
        {#if w.rationale}
          <div class="mt-1 text-xs text-neutral-600">{w.rationale}</div>
        {/if}
      </div>
      <button
        type="button"
        class="shrink-0 rounded border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100"
        onclick={() => copyShoreMessage(w)}
        aria-label={`Copy shore comm message for ${w.label} window`}
      >
        {copiedLabel === w.label ? '✓ Copied' : '📋 Copy shore msg'}
      </button>
    </div>
  </div>
{/each}
```

- [ ] **Step 2: Run the dev server and inspect a bay-launch verdict**

Run: `npm run dev`
Open: http://localhost:5173
Toggle to `humboldt-bay-interior` + a species like `california-halibut`. Inspect:
- Each window's tide chip renders below the launch/return times.
- On a bad-tide day, the morning window shows ⚠ with the warning text — or is missing entirely (suppressed).
- Slack-anchored windows show their tide chip; usually no warning.

If the dev server doesn't show what you'd expect from the current fixtures, run `npm run smoke` to refresh against live NOAA.

- [ ] **Step 3: Run full suite (no regressions in tests)**

Run: `npm test`
Expected: PASS (237 tests; UI changes don't affect them).

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/DayCard.svelte
git commit -m "DayCard: render tide chip + warning badge on launch windows"
```

---

## Task 8: Final integration + smoke

**Files:** None modified.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS (237 tests).

- [ ] **Step 2: Run typecheck + build**

Run: `npm run check && npm run build`
Expected: 0 errors; clean build.

- [ ] **Step 3: Run smoke against live NOAA**

Run: `npm run smoke`
Expected: PASS. Live currents from HUB0203 + the fixture parsers stay in sync.

- [ ] **Step 4: Manual verification — verdict output for a bay launch**

Run: `npm run dev`
Open `humboldt.fish` locally → toggle to `humboldt-bay-interior` + `california-halibut`. Verify:
- Multiple windows render on tide-rich days
- Tide chip text is human-readable
- Warning badge appears on the right days

- [ ] **Step 5: Confirm clean working tree**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 6: Push and deploy**

```bash
git push origin main
```

GitHub Actions deploys to Cloudflare Pages automatically.

---

## Self-review notes

**Spec coverage:**
- ✅ Annotation on dawn/dusk + slack windows: Task 3 + Task 6.
- ✅ Clamp returnBy at ebb > 1.5 kt: Task 4 + Task 6.
- ✅ Suppress when < 2h: Task 4.
- ✅ Always-show slack siblings (morning + afternoon): Task 5 + Task 6.
- ✅ Morning + evening symmetric: Task 6 (loop processes all non-slack windows identically).
- ✅ Skips when currents data missing: Task 6 (entire annotate/clamp block is guarded by `data.tidalCurrents`).
- ✅ Asymmetric thresholds: constants `EBB_WARN_KT = 1.5`, `FLOOD_WARN_KT = 3.0`. Flood warns but doesn't clamp (`clampReturnByForEbb` only acts on ebb).
- ✅ Trinidad / freshwater / lagoons short-circuit: guarded by `currentStation` presence.
- ✅ UI rendering: Task 7.

**Type consistency:**
- `TidePhaseAnnotation.peakTimeLocal` uses "HH:MM PT" form throughout.
- Helpers consistently take and return "YYYY-MM-DDTHH:MM" Pacific-local ISO strings.
- `LaunchWindow.tide` and `.warning` are added in Task 2 and consumed in Tasks 6 + 7.

**Risks the implementer should watch for:**
- The PT-local ISO string format (`"YYYY-MM-DDTHH:MM"`) lacks a timezone marker. Do not pass it to `new Date()` — that interprets it as UTC. All time math in the new code path is done via `ptIsoToMinutes` / `minutesToPtIso` which are pure string-arithmetic.
- The existing `shiftPacificTime` (used by the afternoon-slack block) is a different helper from the new `shiftPtIso` — naming is intentionally distinct (different output format: `"HH:MM PT"` vs `"YYYY-MM-DDTHH:MM"`).
- The pre-existing test `Mad River Slough with afternoon slack data: 3 windows` uses a synthetic fixture without a morning slack in 04:00–11:00. Verify that test still passes; if it goes to 4 because a synthesized morning slack is being read, check the fixture data.
- Be careful with the existing `formatPacificTime(d)` vs reading `slice(11,16)` off an ISO string — they should agree but cross-check the first test that uses both forms.
