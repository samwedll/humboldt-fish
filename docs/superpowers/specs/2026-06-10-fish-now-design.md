# "Can I Fish Right Now?" — Time-aware Windows + Now-verdict — Design

**Date:** 2026-06-10
**Status:** Design (pre-implementation)
**Scope:** Today card only; all launches, all species

---

## Problem

The verdict pipeline has no concept of wall-clock time. `runLogistics()` receives only a date string, so a morning window that ended five hours ago is returned — and rendered — identically to a future one. There is no past/in-progress/upcoming state, no remaining-daylight math, and window suppression (since b823f12) is structural only, never temporal.

The user's actual question on the day of a trip is "can I go **right now**, or in the next hour?" Today the app can't answer it: past windows display as launchable, and nothing compares now + trip length against civil dusk or current tide phase.

## Goals

1. **Time-aware windows**: today's launch windows (including suppressed stubs) gain past / active / upcoming states relative to wall-clock.
2. **Now-verdict**: a dedicated evaluation anchored at the current minute — launch now, return by `min(now + 4h, civil dusk)` — with its own GO / CONDITIONAL / NO-GO.
3. **Next viable start**: when "now" fails on a *temporal* gate (mid-ebb, pre-dawn, too little daylight), report the next time today it would pass: "Not now — ebb until 14:10; viable from 14:10."
4. **Honest about what the pipeline can't verify**: a now-GO renders an explicit pre-launch checklist (bar recorder, salmon hotline when salmon is selected, low-light gear when applicable) instead of burying the canonical footer.
5. **Stale data can't silently produce a GO**: buoy observation age is a verdict input, not just a caption.
6. The evaluator is a pure function shared with the Phase 3 MCP server.

## Non-goals

- No new data sources (no NWS hourly gridpoints; we keep the CWF text product per `nws-marine-api-deprecation` reality).
- No push notifications or alerting when a window opens.
- No persisted checklist state — the boxes are a reminder, not a form.
- No auto-polling of NOAA endpoints while the tab is open.
- No changes to `reference/` — this is timing/presentation logic, not new domain rules. Every rule the now-verdict applies already exists in `reference/thresholds.md` / `launches.md`.
- No changes to non-today day cards.

## Design decisions (settled in brainstorming)

| Decision | Choice |
|---|---|
| Scope | Time-aware window states **and** a now-verdict; states are the foundation |
| Time anchor | Always evaluate "now"; report next viable start when a temporal gate fails |
| Safety gate | GO is reachable on the data layers, with an explicit pre-launch checklist rendered beside the verdict |
| Staleness | Fresh fetch on request (respecting 10-min TTL) + age gate: obs older than 60 min degrade the affected open-ocean factors to ⚠ |
| Placement | "Right now" strip at the top of the Today card; window rows get state badges |
| Liveness | Client-side minute tick re-derives temporal state from in-memory data; network refetch only on load or explicit refresh |
| Architecture | Shared pure evaluator `evaluateNow(nowMs, payload)`; server enriches payload with epoch-ms timestamps; client owns wall-clock |

## Now-verdict semantics

`evaluateNow(nowMs, todayPayload)` — pure, never reads the clock — runs two kinds of gates.

### Temporal gates (deterministic, from tide/current events + suntimes in the payload)

- **Pre-dawn**: before civil dawn → not viable yet; next viable = dawn. (Pre-dawn launches stay suppressed exactly as the window machinery treats them; the nav-lights/float-plan/VHF preconditions in `thresholds.md` are gear the pipeline can't verify.)
- **Minimum trip**: `returnBy − now ≥ 2h`, where `returnBy = min(now + 4h, civil dusk)`. Same 2-hour minimum and 4-hour year-1 cap the window suppression already uses. Under 2h left → "done for today."
- **Tide phase** (launches with a `currentStation` only): reuses the same canonical tide guidance as `runLogistics` (launch on slack or flood; the ebb-clamp thresholds). Mid-ebb → not viable; next viable = next slack/flood start. Trinidad and the lagoons skip this gate, same as the window machinery.

### Condition gates (same verdict algebra as `computeVerdict`)

- Layer 1 (Legal) results carry over from the day verdict unchanged. Any ✗ → NO-GO.
- Layer 2 (Safety) evaluates the forecast period(s) overlapping `[now, returnBy]`, not the whole-day worst case. A calm morning with an ugly afternoon forecast can be GO now even when the day card shows ⚠. If no period covers the span, fall back to whole-day worst case and say so in the factor note — never silently more optimistic.
- For today + open-ocean launches, buoy obs confirm conditions, with the **age gate**: obs ≤ 60 min old count as live confirmation; older degrades the affected factors to ⚠ "can't confirm current conditions (buoy data 1h 40m old)". This sits on top of — not instead of — the existing missing-buoy handling.
- Verdict algebra unchanged: any ✗ → NO-GO; any Layer 2 ✗ → NO-GO; ≥2 Layer 2 ⚠ → CONDITIONAL with bailout plan; all green → GO. Conservative thresholds are applied exactly as configured; nothing is softened at runtime.

### Output

```ts
type NowVerdict = {
  verdict: 'GO' | 'CONDITIONAL' | 'NO-GO';
  reason?: string;          // primary blocker, human-readable
  nextViableAt?: number;    // epoch ms — set ONLY when the blocker is temporal
  launchBy?: number;        // epoch ms — set when viable but a temporal gate closes soon
  returnBy?: number;        // epoch ms — min(now + 4h, civil dusk)
  factors: NowFactor[];     // per-factor ✓/⚠/✗ with notes (mirrors layer-table rows)
  checklist: ChecklistItem[];
  staleness: { obsAgeMs: number | null; degraded: boolean };
};
```

- Temporal blocker with conditions otherwise passing → NO-GO **with** `nextViableAt`.
- Conditions blocker (e.g., swell over threshold) → plain NO-GO, no `nextViableAt` — swell doesn't run on a schedule.
- The `nextViableAt` scan considers only today's remaining daylight: candidate starts are now, civil dawn, and slack/flood event starts after now, each re-checked against the 2h-minimum rule. If none pass → "done for today."
- `launchBy` = latest start at which all temporal gates still pass (e.g., "launch by 15:10 — ebb starts building").
- GO/CONDITIONAL output retains the canonical closing line: "Verify the bar status and salmon hotline within 2 hours of launch. Conditions can change fast on the North Coast." The checklist makes it actionable; the sentence stays.

### Checklist

Items and trigger conditions live in `src/lib/config/checklist.ts`, each citing its `reference/` source in a comment:

- Bar status recorder — always (canonical footer, `SKILL.md`)
- Salmon hotline — when salmon is among selected species (canonical footer, `regs/`)
- Nav lights + filed float plan + VHF check — when `launchAt` is within 30 min after civil dawn, or `returnBy` lands within 30 min of civil dusk (`thresholds.md` pre-dawn/low-light preconditions; 30 min mirrors the dawn+30 offset `runLogistics` already uses)

Display-only; no persisted check state.

## Window states

Second pure helper, `windowState(nowMs, window)`:

- `past` — `returnByMs < now`
- `active` — `launchAtMs ≤ now ≤ returnByMs`
- `upcoming` — `launchAtMs > now`

Applies to suppressed stubs too. Non-today cards never call it.

## Architecture and data flow

```
/api/verdict (server, per PT-date)          client (+page.svelte)
  computeVerdict() as today                   load → render day cards
  + payload enrichment:                       Today card:
    epoch-ms fields on windows,                 NowStrip = evaluateNow(Date.now(), today)
    tide/current events, suntimes,              window badges = windowState(now, window)
    buoy obsTime, forecast period spans       $effect minute tick → re-derive both
                                              visibilitychange → immediate re-derive
                                              refresh control → refetch /api/verdict
```

The server does **not** compute the now-verdict; it only enriches the payload with machine-readable timestamps. The client owns wall-clock. Phase 3's MCP server calls the same `evaluateNow` with server time.

## Types and payload changes

`src/lib/types.ts`:

- `LaunchWindow` gains `launchAtMs`, `returnByMs`, `checkInByMs` (epoch ms). Existing `"HH:MM PT"` display strings stay untouched.
- New `NowVerdict`, `NowFactor`, `ChecklistItem`, `WindowState` types.
- Day payload gains: `dawnMs`/`duskMs`, tide/current events with epoch ms (timestamps exist server-side; they need to survive into the JSON), buoy `obsTimeMs`, forecast periods with `startMs`/`endMs`.

New modules (all pure): `src/lib/verdict/evaluateNow.ts`, `src/lib/verdict/windowState.ts`. New config: `src/lib/config/checklist.ts`.

## UI

- **`NowStrip.svelte`** — rendered only in the Today card, above the windows list:

  ```
  ▸ RIGHT NOW (14:32 PT)
    🟢 GO — launch now, return by 18:32
    Flood until 16:48 · dusk 21:05
    Buoy 46244: 3.2 ft @ 12s · 6 kt (9m ago)
    Before leaving: ☐ Bar recorder
                    ☐ Salmon hotline
  ```

- **`DayCard.svelte`** — window rows gain a state badge (▪ past, ● active, ○ upcoming); past windows get muted styling. Non-today cards unchanged.
- **`+page.svelte`** — owns `nowMs` as `$state`, updated by a minute `setInterval` inside `$effect` (cleaned up on destroy), plus a `visibilitychange` listener for instant correction on tab refocus. A refresh control on the Today card refetches `/api/verdict`.

## Error handling and edge cases

- **No `currentStation`** (Trinidad, lagoons): tide gate skipped, exactly as window logic does today; the tide phrase drops from the context line.
- **Buoy fetch failed / absent**: existing pipeline behavior applies (floor of ⚠ for open-ocean); the age gate composes on top.
- **No forecast period covering `[now, returnBy]`**: whole-day worst case, flagged in the factor note.
- **Midnight PT rollover with the tab open**: the minute tick detects payload date ≠ current PT date and swaps the NowStrip for a "data is for a previous day — refresh" notice instead of computing nonsense.
- **Client clock skew**: accepted risk for a single-user tool.
- All time math in epoch ms; PT formatting only at the display boundary via the existing formatter.

## Testing

`evaluateNow` and `windowState` take `nowMs` as an argument, so fixtures need no clock mocking:

- Pre-dawn → not viable, `nextViableAt` = dawn
- Mid-ebb → not viable, `nextViableAt` = next slack/flood; scan respects 2h minimum
- `<2h` before dusk → "done for today"
- `returnBy` capped by 4h vs by dusk (both sides of the `min`)
- Fresh buoy → GO; stale buoy at/over the 60-min boundary → factor degrades, verdict follows layer rules
- Conditions-NO-GO has no `nextViableAt`; temporal-NO-GO has one
- `launchBy` emitted when a temporal gate closes within the viable span
- No-`currentStation` launch skips tide gate
- Forecast-period selection for `[now, returnBy]`; whole-day fallback flagged
- Date-rollover detection
- `windowState` boundaries (at `launchAtMs`, at `returnByMs`)
- Payload enrichment: ms fields serialize and agree with their `"HH:MM PT"` strings

`npm run smoke` unaffected — no parser changes.

## Implementation order (for the plan)

1. Payload enrichment + types (server → JSON)
2. `windowState` + badges in `DayCard`
3. `evaluateNow` core (temporal gates, then condition gates, then scan)
4. `checklist.ts` config
5. `NowStrip.svelte` + minute tick + refresh control
6. Rollover notice
