# Trinidad Lee/Exposure Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the open-Pacific swell threshold 5→6 ft and model Trinidad Head's NW lee (7 ft when swell is from 300–340°, fail-closed otherwise), exposed via a per-trip `exposure` toggle, while recording the Bixpy motor and retiring the `reference/` read-only convention.

**Architecture:** Exposure is a trip parameter (`'lee' | 'open'`, default `'open'`), not a new `LaunchId` — both zones are the same physical Trinidad launch. A single `resolveSwellLimit` helper in `runSafety.ts` owns the height-limit decision and is called by all three swell-evaluation paths (buoy day-card, NWS day-card, live "now"), removing the drift risk that caused the prior null-wave gap. `exposure` threads from the UI through the API/orchestrator into `computeVerdict`/`runSafety` for day cards, and directly into `evaluateNow` for the now-strip.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Vitest 4, Zod v4. Package manager: **pnpm** (this repo migrated off npm). NDBC/NWS data fetchers already exist.

## Global Constraints

- Package manager is **pnpm**; full suite is `pnpm test` (vitest run). Single file: `pnpm test <path>`. Type/Svelte check: `pnpm check`.
- Conservative defaults bind: any single Safety `fail` → NO-GO. Never soften a threshold at runtime.
- `reference/*.md` is now canonical and edited directly; mirror every numeric/domain change into `src/lib/config/` **in the same commit**.
- Fail-closed: when swell direction is unknown, the lee bonus is NOT granted — use the 6 ft open limit.
- The lee bonus applies only to `openOcean` launches; ignored everywhere else.
- Bixpy does NOT relax any threshold.
- Commit after every task. Branch is `trinidad-lee-exposure` (already created).

---

### Task 1: Threshold bump + lee constants + `Exposure` type

**Files:**
- Modify: `src/lib/config/thresholds.ts:6-21`
- Modify: `src/lib/types.ts:25` (add `Exposure` type near the other unions)
- Modify: `reference/thresholds.md:16` (swell row) and `:81` (Notes stub)
- Test: `tests/lib/config/thresholds.test.ts`

**Interfaces:**
- Produces: `thresholds.swellHeightFt = 6`, `thresholds.swellHeightLeeFt = 7`, `thresholds.leeSwellArcDeg = [300, 340]` (readonly tuple); `export type Exposure = 'lee' | 'open'`.

- [ ] **Step 1: Update the thresholds test to the new values (write the failing test)**

In `tests/lib/config/thresholds.test.ts`, replace the swell-height line and add three assertions:

```ts
  it('swell height ≤ 6 ft (open Pacific)', () => { expect(thresholds.swellHeightFt).toBe(6); });
  it('swell height ≤ 7 ft in the Trinidad Head lee', () => { expect(thresholds.swellHeightLeeFt).toBe(7); });
  it('NW lee shelter arc is 300–340° true', () => {
    expect(thresholds.leeSwellArcDeg).toEqual([300, 340]);
  });
```

(Delete the old `swell height ≤ 5 ft` line.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/lib/config/thresholds.test.ts`
Expected: FAIL — `swellHeightFt` is 5, `swellHeightLeeFt`/`leeSwellArcDeg` undefined.

- [ ] **Step 3: Update `thresholds.ts`**

In `src/lib/config/thresholds.ts`, change `swellHeightFt` and add the two new constants:

```ts
  swellHeightFt: 6,        // open Pacific (was 5; user upgrade path, June 2026)
  swellHeightLeeFt: 7,     // Trinidad Head lee, NW swell only
  leeSwellArcDeg: [300, 340] as const, // NW shelter arc (inclusive), degrees true
  swellPeriodSec: 10,
```

- [ ] **Step 4: Add the `Exposure` type**

In `src/lib/types.ts`, after the `WindowState` line (`:25`):

```ts
export type Exposure = 'lee' | 'open';
```

- [ ] **Step 5: Mirror into `reference/thresholds.md`**

Change the swell row (`:16`):

```md
| **Swell height** | ≤ 5 ft | Significant wave height from buoy or forecast |
```
to:
```md
| **Swell height (open Pacific)** | ≤ 6 ft | Significant wave height from buoy or forecast. Raised from 5 ft June 2026 after early-season calibration. |
| **Swell height (Trinidad Head lee)** | ≤ 7 ft | Only when swell is from the NW (300–340° true) — the arc the Head actually blocks. On W/S swell the lee gives nothing, so this reverts to 6 ft. Period (≥10 s) and wind/swell alignment still apply unchanged. |
```

Replace the stub note at `:81` (`Trinidad protected up to 7 ft swell`) with:

```md
- **Trinidad Head lee (added June 2026).** Behind the Head, swell tolerance rises to 7 ft — but only when the swell is actually from the NW (300–340° true). The Head shelters NW weather and does nothing in W/S swell, so the bonus is direction-gated and fails closed (reverts to 6 ft) whenever swell direction is unknown. Period and alignment gates are unchanged. Selected per-trip via the "inside the lee / open Pacific" toggle.
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test tests/lib/config/thresholds.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/config/thresholds.ts src/lib/types.ts reference/thresholds.md tests/lib/config/thresholds.test.ts
git commit -m "feat: raise open swell to 6 ft, add lee constants + Exposure type"
```

---

### Task 2: `resolveSwellLimit` shared helper

**Files:**
- Modify: `src/lib/verdict/runSafety.ts` (add export near `evalAbove`, ~`:27`)
- Test: `tests/lib/verdict/runSafety.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `thresholds.{swellHeightFt,swellHeightLeeFt,leeSwellArcDeg}`, `Exposure`, `evalAbove`, `LaunchProfile`.
- Produces:
  ```ts
  export interface SwellLimit { limitFt: number; status: CheckStatus; leeNote?: string; }
  export function resolveSwellLimit(
    heightFt: number,
    swellDirDeg: number | null | undefined,
    exposure: Exposure,
    profile: LaunchProfile
  ): SwellLimit
  ```

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/verdict/runSafety.test.ts`:

```ts
import { resolveSwellLimit } from '../../../src/lib/verdict/runSafety.js';
import { getLaunch } from '../../../src/lib/config/launches.js';

describe('resolveSwellLimit — Trinidad Head lee', () => {
  const tri = getLaunch('trinidad');
  const lagoon = getLaunch('big-lagoon');

  it('open exposure uses the 6 ft limit', () => {
    expect(resolveSwellLimit(6.1, 320, 'open', tri).status).toBe('fail');
    expect(resolveSwellLimit(5.9, 320, 'open', tri).status).not.toBe('fail');
  });

  it('lee + NW swell (320°) grants the 7 ft limit', () => {
    const r = resolveSwellLimit(6.9, 320, 'lee', tri);
    expect(r.limitFt).toBe(7);
    expect(r.status).not.toBe('fail');
    expect(resolveSwellLimit(7.1, 320, 'lee', tri).status).toBe('fail');
  });

  it('arc bounds are inclusive (300 and 340 grant the lee)', () => {
    expect(resolveSwellLimit(6.5, 300, 'lee', tri).limitFt).toBe(7);
    expect(resolveSwellLimit(6.5, 340, 'lee', tri).limitFt).toBe(7);
  });

  it('lee + W swell (270°) is denied → 6 ft limit, fails at 6.5 ft', () => {
    const r = resolveSwellLimit(6.5, 270, 'lee', tri);
    expect(r.limitFt).toBe(6);
    expect(r.status).toBe('fail');
    expect(r.leeNote).toMatch(/not from NW/);
  });

  it('lee + unknown direction fails closed to 6 ft', () => {
    const r = resolveSwellLimit(6.5, null, 'lee', tri);
    expect(r.limitFt).toBe(6);
    expect(r.status).toBe('fail');
    expect(r.leeNote).toMatch(/direction unknown/);
  });

  it('lee on a non-ocean launch is ignored → 6 ft, no lee note', () => {
    const r = resolveSwellLimit(6.5, 320, 'lee', lagoon);
    expect(r.limitFt).toBe(6);
    expect(r.leeNote).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/lib/verdict/runSafety.test.ts`
Expected: FAIL — `resolveSwellLimit` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/lib/verdict/runSafety.ts`, add the `Exposure` import to the existing type import block, then add after `evalAbove` (`:31`):

```ts
export interface SwellLimit {
  limitFt: number;
  status: CheckStatus;
  leeNote?: string;
}

/**
 * Resolve the swell-height limit and pass/warn/fail for a given reading.
 * Trinidad Head shelters from the NW only, so the 7 ft lee bonus applies
 * solely when exposure is 'lee', the launch is open-ocean, AND the swell is
 * from the NW arc (thresholds.leeSwellArcDeg). Fails closed to the 6 ft open
 * limit when direction is unknown or the swell isn't from the NW.
 */
export function resolveSwellLimit(
  heightFt: number,
  swellDirDeg: number | null | undefined,
  exposure: Exposure,
  profile: LaunchProfile
): SwellLimit {
  const [arcLo, arcHi] = thresholds.leeSwellArcDeg;
  const leeEligible = profile.openOcean && exposure === 'lee';
  const inArc = swellDirDeg != null && swellDirDeg >= arcLo && swellDirDeg <= arcHi;
  const leeGranted = leeEligible && inArc;
  const limitFt = leeGranted ? thresholds.swellHeightLeeFt : thresholds.swellHeightFt;

  let leeNote: string | undefined;
  if (leeEligible) {
    if (leeGranted) {
      leeNote = `lee granted: NW swell (${swellDirDeg}°) behind Trinidad Head — ${limitFt} ft limit`;
    } else if (swellDirDeg == null) {
      leeNote = `lee denied: swell direction unknown — fail-closed to ${thresholds.swellHeightFt} ft`;
    } else {
      leeNote = `lee denied: swell ${swellDirDeg}° not from NW (${arcLo}–${arcHi}°) — ${thresholds.swellHeightFt} ft limit`;
    }
  }
  return { limitFt, status: evalAbove(heightFt, limitFt), leeNote };
}
```

Note: `LaunchProfile` and `thresholds` are already imported in this file. Add `Exposure` to the `import type { … } from '../types.js'` block at the top.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test tests/lib/verdict/runSafety.test.ts`
Expected: PASS (new block green; existing buoy-path tests still green — all use ≤3.5 ft or 10.5 ft, unaffected by 5→6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict/runSafety.ts tests/lib/verdict/runSafety.test.ts
git commit -m "feat: add resolveSwellLimit helper for Trinidad Head lee"
```

---

### Task 3: Thread `exposure` through the day-card paths (buoy + NWS)

**Files:**
- Modify: `src/lib/verdict/runSafety.ts` (`SafetyInput`, `runSafety`, `runSafetyFromBuoy`, `runSafetyFromNws`)
- Modify: `src/lib/verdict/computeVerdict.ts` (`ComputeInput`, the `runSafety` call `:117`)
- Modify: `src/lib/server/orchestrate.ts` (`OrchestrateInput`, the `computeVerdict` call)
- Modify: `src/routes/api/verdict/+server.ts` (parse `exposure` param)
- Test: `tests/lib/verdict/runSafety.test.ts`

**Interfaces:**
- Consumes: `resolveSwellLimit` (Task 2).
- Produces: `SafetyInput.exposure?: Exposure`; `ComputeInput.exposure?: Exposure`; `OrchestrateInput.exposure?: Exposure`. All default to `'open'`.

- [ ] **Step 1: Write the failing tests (buoy + NWS lee behavior end-to-end)**

Append to `tests/lib/verdict/runSafety.test.ts`:

```ts
describe('runSafety — exposure threading (buoy path)', () => {
  function buoyAt(waveHtFt: number, meanWaveDirDeg: number) {
    return calmBuoyData({
      ndbc46244: {
        observedAt: '2026-05-17T14:00:00Z',
        windKt: 6, gustKt: 8, windDirDeg: meanWaveDirDeg,
        waveHtFt, dominantPeriodSec: 12, meanWaveDirDeg, waterTempF: 52
      }
    });
  }

  it('6.5 ft NW swell: open → fail, lee → not fail', () => {
    const open = runSafety({ date: '2026-05-17', launch: 'trinidad', data: buoyAt(6.5, 320) });
    expect(open.checks.find((c) => c.name === 'Swell height')?.status).toBe('fail');

    const lee = runSafety({ date: '2026-05-17', launch: 'trinidad', exposure: 'lee', data: buoyAt(6.5, 320) });
    expect(lee.checks.find((c) => c.name === 'Swell height')?.status).not.toBe('fail');
  });

  it('6.5 ft W swell (270°) with lee → still fail (direction gate)', () => {
    const lee = runSafety({ date: '2026-05-17', launch: 'trinidad', exposure: 'lee', data: buoyAt(6.5, 270) });
    expect(lee.checks.find((c) => c.name === 'Swell height')?.status).toBe('fail');
  });

  it('lee Swell-height check reports the resolved limit in its threshold', () => {
    const lee = runSafety({ date: '2026-05-17', launch: 'trinidad', exposure: 'lee', data: buoyAt(6.5, 320) });
    expect(lee.checks.find((c) => c.name === 'Swell height')?.threshold).toBe('≤ 7 ft');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/lib/verdict/runSafety.test.ts`
Expected: FAIL — `runSafety` ignores `exposure`; threshold reads `≤ 6 ft` and 6.5 ft fails under lee.

- [ ] **Step 3: Add `exposure` to `SafetyInput` and thread it**

In `src/lib/verdict/runSafety.ts`:

Add to `SafetyInput` (after `launch`):
```ts
  exposure?: Exposure;
```

In `runSafety`, change the signature destructure and compute a resolved exposure:
```ts
export function runSafety({ date, today = '0000-00-00', launch, exposure = 'open', data }: SafetyInput): SafetyOutput {
```

Pass `exposure` and `profile` into both buoy and NWS helpers — update their signatures and calls:
```ts
  if (buoyMatchesDate && buoy && profile.requiresSwellCheck) {
    return runSafetyFromBuoy(buoy, profile, pointChecks, exposure);
  }
```
```ts
      return runSafetyFromNws(match.period.detailedForecast, date, profile, pointChecks, exposure);
```

- [ ] **Step 4: Use `resolveSwellLimit` in `runSafetyFromBuoy`**

Change the signature to `function runSafetyFromBuoy(buoy, profile, pointChecks, exposure: Exposure)` and replace the swell-height block (`:219-227`):

```ts
  if (profile.requiresSwellCheck && buoy.waveHtFt !== null) {
    const lim = resolveSwellLimit(buoy.waveHtFt, buoy.meanWaveDirDeg, exposure, profile);
    checks.push({
      layer: 'safety',
      name: 'Swell height',
      value: `${buoy.waveHtFt.toFixed(1)} ft`,
      threshold: `≤ ${lim.limitFt} ft`,
      status: lim.status,
      ...(lim.leeNote ? { note: lim.leeNote } : {})
    });
  }
```

- [ ] **Step 5: Use `resolveSwellLimit` in `runSafetyFromNws`**

Change the signature to `function runSafetyFromNws(text, date, profile, pointChecks, exposure: Exposure)` and replace the swell-height block (`:314-322`):

```ts
  if (profile.requiresSwellCheck && p.seasFt !== undefined) {
    const lim = resolveSwellLimit(p.seasFt, p.swellDirDeg, exposure, profile);
    checks.push({
      layer: 'safety',
      name: 'Swell height',
      value: `${p.seasFt} ft`,
      threshold: `≤ ${lim.limitFt} ft`,
      status: lim.status,
      note: lim.leeNote ? `NWS Seas (combined sea state); ${lim.leeNote}` : 'NWS Seas (combined sea state)'
    });
  }
```

- [ ] **Step 6: Thread `exposure` through `computeVerdict` and `orchestrate`**

In `src/lib/verdict/computeVerdict.ts`: add `exposure?: Exposure;` to `ComputeInput` (after `launch`), import `Exposure` in the type block, destructure it in `computeVerdictCore` (`:92`):
```ts
  const { date, today = '0000-00-00', species, launch, exposure = 'open', data } = input;
```
and pass it to `runSafety` (`:117`):
```ts
  const safety = runSafety({ date, today, launch, exposure, data });
```

In `src/lib/server/orchestrate.ts`: add `exposure?: Exposure;` to `OrchestrateInput`, import `Exposure`, destructure it in `orchestrateVerdict` (`exposure` alongside `species, launch`), default `'open'`, and pass into the `computeVerdict` map call:
```ts
  const { species, launch, exposure = 'open', days, today, fetchers } = input;
  ...
  const verdicts: Verdict[] = dates.map((date) =>
    computeVerdict({ date, today, species, launch, exposure, data })
  );
```

- [ ] **Step 7: Parse `exposure` in the API handler**

In `src/routes/api/verdict/+server.ts`, after the launch param (`:48`):
```ts
  const exposureParam = (url.searchParams.get('exposure') ?? 'open') as 'lee' | 'open';
  if (exposureParam !== 'lee' && exposureParam !== 'open') throw error(400, 'invalid exposure');
```
and add `exposure: exposureParam` to the `orchestrateVerdict({ ... })` call (`:112`).

- [ ] **Step 8: Run the suite**

Run: `pnpm test`
Expected: PASS (new exposure tests green; all existing green).

- [ ] **Step 9: Type check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/verdict/runSafety.ts src/lib/verdict/computeVerdict.ts src/lib/server/orchestrate.ts src/routes/api/verdict/+server.ts tests/lib/verdict/runSafety.test.ts
git commit -m "feat: thread exposure through day-card swell paths"
```

---

### Task 4: Apply the lee model in the live "now" path

**Files:**
- Modify: `src/lib/verdict/evaluateNow.ts` (`buoyFactors`, `conditionsAt`, `evaluateNow` ctx)
- Test: `tests/lib/verdict/evaluateNow.test.ts`

**Interfaces:**
- Consumes: `resolveSwellLimit` (Task 2), `Exposure` (Task 1).
- Produces: `evaluateNow(nowMs, day, ctx)` where `ctx: { launch: LaunchId; species: Species; exposure?: Exposure }` (default `'open'`).

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/verdict/evaluateNow.test.ts`. This reuses the file's existing `trinidadNowData`, `dayVerdict`, `TRINIDAD`, and `PT` helpers (defined at the top of the file). The buoy is observed at `13:50` and `nowMs` is `14:00`, so the 10-min age is well under `NOW_BUOY_MAX_AGE_MS` (no staleness flooring):

```ts
describe('evaluateNow — Trinidad lee exposure', () => {
  const nwBuoy = trinidadNowData({
    buoy: {
      observedAt: new Date(PT('13:50')).toISOString(),
      observedAtMs: PT('13:50'),
      windKt: null, gustKt: null, windDirDeg: null,
      waveHtFt: 6.5, dominantPeriodSec: 12, meanWaveDirDeg: 320, waterTempF: 52
    }
  });

  it('6.5 ft NW swell: open exposure fails swell height', () => {
    const r = evaluateNow(PT('14:00'), dayVerdict(nwBuoy), TRINIDAD)!;
    expect(r.factors.find((f) => f.name === 'Swell height')?.status).toBe('fail');
  });

  it('6.5 ft NW swell: lee exposure clears swell height', () => {
    const r = evaluateNow(PT('14:00'), dayVerdict(nwBuoy), { ...TRINIDAD, exposure: 'lee' })!;
    expect(r.factors.find((f) => f.name === 'Swell height')?.status).not.toBe('fail');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/lib/verdict/evaluateNow.test.ts`
Expected: FAIL — `evaluateNow` ignores exposure; lee swell height still fails at 6.5 ft.

- [ ] **Step 3: Thread exposure into `buoyFactors` and `evaluateNow`**

In `src/lib/verdict/evaluateNow.ts`:

Add `Exposure` to the `import type { … } from '../types.js'` block and import `resolveSwellLimit` from `./runSafety.js` (the file already imports `evalAbove, evalAtLeast` from there — add it to that import).

Change `buoyFactors` signature to accept exposure:
```ts
function buoyFactors(
  tMs: number,
  nowData: NowData,
  profile: LaunchProfile,
  exposure: Exposure
): { factors: Check[]; obsAgeMs: number | null; degraded: boolean } {
```

Replace the swell-height push (`:177-183`) with:
```ts
  const factors: Check[] = [];
  const lim = resolveSwellLimit(buoy.waveHtFt, buoy.meanWaveDirDeg, exposure, profile);
  factors.push({
    layer: 'safety',
    name: 'Swell height',
    value: `${buoy.waveHtFt.toFixed(1)} ft`,
    threshold: `≤ ${lim.limitFt} ft`,
    status: lim.status,
    ...(lim.leeNote ? { note: lim.leeNote } : {})
  });
```

In `evaluateNow`, change the ctx type and pass exposure down:
```ts
export function evaluateNow(
  nowMs: number,
  day: Verdict,
  ctx: { launch: LaunchId; species: Species; exposure?: Exposure }
): NowVerdict | null {
```
Just after `const profile = getLaunch(ctx.launch);`, add:
```ts
  const exposure: Exposure = ctx.exposure ?? 'open';
```
And in the `conditionsAt` closure (`:322`):
```ts
    const b = buoyFactors(tMs, nowData, profile, exposure);
```

(The `buoy.waveHtFt === null` fail-closed branch above stays as-is — it keeps using `thresholds.swellHeightFt` because lee can't apply without a height reading.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/lib/verdict/evaluateNow.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + type check**

Run: `pnpm test && pnpm check`
Expected: all PASS, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/verdict/evaluateNow.ts tests/lib/verdict/evaluateNow.test.ts
git commit -m "feat: apply Trinidad lee model in the live now path"
```

---

### Task 5: UI exposure toggle (Trinidad only)

**Files:**
- Modify: `src/routes/+page.svelte` (state, toggle markup, `reload`, `syncUrl`, `evaluateNow` ctx)

**Interfaces:**
- Consumes: `Exposure` type; API `exposure` query param (Task 3); `evaluateNow` ctx `exposure` (Task 4).

- [ ] **Step 1: Add exposure state + URL seeding**

In the `<script>` block of `src/routes/+page.svelte`, near the other `$state` (`:28-29`), add (import `Exposure` from `$lib/types.js` alongside the existing type imports):
```ts
  function initialExposure(): Exposure {
    if (typeof window === 'undefined') return 'open';
    return new URLSearchParams(window.location.search).get('exposure') === 'lee' ? 'lee' : 'open';
  }
  let exposure: Exposure = $state(initialExposure());
```

- [ ] **Step 2: Send exposure to the API and URL**

In `reload` (`:41`), include exposure in the query string:
```ts
      const qs = new URLSearchParams({ species, launch, exposure, days: '7' });
```
In `syncUrl` (`:56-60`), persist it:
```ts
    qs.set('exposure', exposure);
```

- [ ] **Step 3: Add the setter and pass exposure to `evaluateNow`**

Add a setter near `setLaunch` (`:69`):
```ts
  async function setExposure(e: Exposure) {
    exposure = e;
    syncUrl();
    await reload();
  }
```
Update the now-verdict derivation (`:104`):
```ts
  let nowVerdict = $derived(today ? evaluateNow(nowMs, today, { launch, species, exposure }) : null);
```

- [ ] **Step 4: Render the toggle (Trinidad only)**

Near the launch `<select>` (`:165`), add a conditional toggle. Match the existing control styling in this file (reuse the same button/segment classes the species or launch controls use):
```svelte
  {#if launch === 'trinidad'}
    <div class="flex gap-1" role="group" aria-label="Exposure">
      <button
        class:selected={exposure === 'open'}
        onclick={() => setExposure('open')}
        title="Open Pacific — swell ≤ 6 ft"
      >Open Pacific</button>
      <button
        class:selected={exposure === 'lee'}
        onclick={() => setExposure('lee')}
        title="Inside the lee (behind Trinidad Head) — swell ≤ 7 ft when from the NW"
      >Inside the lee</button>
    </div>
  {/if}
```
(Adapt class names to the file's existing toggle pattern — do not invent a new visual style.)

- [ ] **Step 5: Type/Svelte check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 6: Manual verification (user runs the dev server)**

Ask Sam to run `pnpm dev:clean` in a fresh terminal (per CLAUDE.md, the agent never starts the dev server). Verify: the toggle appears only for Trinidad; switching to "Inside the lee" reloads and, on an NW-swell day in the 6–7 ft band, flips the Safety swell-height row from fail→pass; the `?exposure=lee` param persists on reload; switching to a lagoon hides the toggle.

- [ ] **Step 7: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: Trinidad lee/open exposure toggle in the UI"
```

---

### Task 6: Record Bixpy gear + retire the reference/ read-only convention

**Files:**
- Modify: `reference/context.md` (Bixpy → owned; open-questions cleanup)
- Modify: `CLAUDE.md` (reference/ convention)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Move Bixpy into owned gear in `context.md`**

In `reference/context.md`, under "Safety Gear — Current Inventory → Owned", add:
```md
- ✅ **Electric drive:** Bixpy K-1 motor + 768 Wh battery + Hobie adapter (acquired June 2026). **Does not relax any go/no-go threshold** — motors and batteries fail, and cold water sharply cuts battery capacity. Year-1 role: bailout / get-home margin and holding position, not a license to launch in worse conditions.
```
Remove the Bixpy line from "Future Upgrade Path" (`:72`) and the "Bixpy electric retrofit decision (fall 2026…)" item from "Open Questions / Future Decisions" (`:331`).

- [ ] **Step 2: Update the convention in `CLAUDE.md`**

In `CLAUDE.md`, replace the "Reference files are read-only inside Claude Code sessions … happen in conversation with Claude.ai" bullet under "Project conventions" with:
```md
- **`reference/` is canonical and edited here.** The claude.ai skill workflow is retired (June 2026). Edit `reference/*.md` directly, and mirror any numeric/domain change into `src/lib/config/` in the **same commit**. These files remain the source of truth for domain knowledge — change them deliberately.
```
Also update the "Read first" intro line that calls `reference/` "a verbatim copy of the `humboldt-fishing-go-nogo` skill" to note it is now maintained directly in this repo.

- [ ] **Step 3: Sanity check the suite still passes (docs shouldn't affect it)**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add reference/context.md CLAUDE.md
git commit -m "docs: record Bixpy gear, retire reference/ read-only convention"
```

---

## Final verification

- [ ] `pnpm test` — full suite green.
- [ ] `pnpm check` — 0 type/Svelte errors.
- [ ] `pnpm build` — production build succeeds (Cloudflare adapter).
- [ ] Manual: Sam confirms the toggle behavior on a fresh `pnpm dev:clean`.
- [ ] Open PR to `main` (auto-deploys to https://humboldt.fish on merge).
