# Humboldt Fishing Checker

A tool that answers "should I fish tomorrow?" by pulling live NOAA marine data and applying the user's personal thresholds and decision framework. Live at **https://humboldt.fish** (Cloudflare Pages, auto-deployed from `main`).

## Read first

The canonical reference for this project lives in **`reference/`** — it's a verbatim copy of the `humboldt-fishing-go-nogo` skill from Claude.ai. Before doing anything substantive, read in this order:

1. **`reference/SKILL.md`** — the four-layer decision framework (Legal → Safety → Quality → Logistics) and how it gets applied
2. **`reference/context.md`** — who the user is, the boat (a specific 14-foot pedal kayak), license/gear inventory, local resources
3. **`reference/thresholds.md`** — the user's personal go/no-go numbers (wind, swell, period, etc.) and the user-set permanent rules (no Humboldt bar crossing ever; Trinidad-only for open ocean)
4. **`reference/data-sources.md`** — every API endpoint, buoy ID, NWS zone, tide station, and hotline number, with notes on which to trust when they conflict
5. **`reference/launches.md`** — launch sites by tier and the decision tree for matching conditions to launch
6. **`reference/decision-template.md`** — the canonical output format for go/no-go decisions
7. **`reference/regs/`** — current-season regulation files for rockfish/lingcod and salmon

## Commands

```bash
npm test            # vitest run — full suite (243+ tests)
npm run dev         # vite dev server on http://localhost:5173
npm run dev:clean   # kills orphan vite processes first, then starts dev
npm run check       # svelte-check (TypeScript + Svelte)
npm run build       # production build (Cloudflare adapter)
npm run smoke       # hit live NOAA endpoints, validate parsers don't drift
```

Push to `main` → GitHub Actions runs `npm test` + `npm run build` + `wrangler pages deploy`. No manual deploy step.

**Long-lived watchers run in the user's terminal, not via tool calls.** `npm run dev`, `dev:clean`, and `test:watch` accumulate inotify watchers and file handles. Background-spawning these from a Claude session and walking away has crashed the system before. When you need to verify UI changes, **ask the user to run `npm run dev:clean` in a fresh terminal** — don't start it yourself via Bash. Same rule for `vitest --watch`. One-shot `npm test` is fine to run via tools (terminates cleanly).

## Why this project exists

The skill works fine when Claude has live access to NOAA APIs. In Claude.ai chat, the data-fetch path goes through a caching layer that serves federal endpoints stale (sometimes days old). On the user's Fedora dev box running Claude Code, `web_fetch` and `bash` execute from local network — direct hits to NOAA APIs, no cache, fresh data every time.

This tool runs on the user's dev box and gives them a green/yellow/red call with the four-layer table populated from live readings. Later it gets promoted to a web UI and eventually an MCP server that Claude.ai can call back to.

## Project conventions

- **Reference files are read-only inside Claude Code sessions** — they are the canonical domain knowledge. Updates to thresholds, launches, regs etc. happen in conversation with Claude.ai (where the skill lives), then get copied back into `reference/`. Do not edit them from within this project unless explicitly asked.
- **Code lives in `src/lib/`** — SvelteKit project. Verdict pipeline at `src/lib/verdict/` (one file per layer: `runLegal`, `runSafety`, `runQuality`, `runLogistics`, plus `computeVerdict` orchestrator). Data fetchers at `src/lib/fetchers/`. Config mirrors of reference files at `src/lib/config/`.
- **Conservative defaults are not negotiable in-conversation.** If a threshold says ≤5 ft swell, the verdict is NO-GO at 5.1 ft. The user wrote the thresholds to bind future-self. Don't soften them at runtime.
- **For solo trips outside Humboldt jetties: always NO-GO** in year-1 ocean regardless of conditions. This is in `thresholds.md` and is permanent until the user edits the file.
- **Two hardcoded user rules** (in `launches.md` and `thresholds.md`):
  - No Humboldt Bay jetty crossings, ever. Not unlocked by good bar reports or future skill.
  - Trinidad is the only open-Pacific launch.
- **Verdict logic**: any Layer 1 ✗ → NO-GO; any Layer 2 ✗ → NO-GO; ≥2 Layer 2 ⚠ → CONDITIONAL with explicit bailout plan; all green → GO.
- **Always end GO/CONDITIONAL output with**: "Verify the bar status and salmon hotline within 2 hours of launch. Conditions can change fast on the North Coast."

## Current phase

- **Phase 2 (shipped)**: SvelteKit web app deployed to Cloudflare Pages at https://humboldt.fish. Single-page UI, day cards with the four-layer verdict, species/launch toggles, multi-window launch recommendations.
- **Phase 3 (next)**: Wrap the verdict core as an MCP server so Claude.ai chat can call it as a connector — permanent fix for the cache-staleness problem.

Latest session snapshot at `docs/superpowers/handoffs/`. The original `HANDOFF.md` in the repo root is Phase-1-era; treat it as historical.

## Tech preferences (the user's style)

- TypeScript / SvelteKit 5 (runes mode), Tailwind, Vitest 4, Zod v4
- Direct API calls (NOAA, NWS, NDBC) over MCP wrappers when MCP adds no abstraction
- Add a dependency only when it earns its keep — stdlib first
- Skill-style structured docs (hotline numbers, source citations, update schedules, explicit "known gaps")
- Conservative numerics; surface assumptions in code comments, not hidden constants
- Domain rules belong in `reference/` (canonical) and get mirrored into `src/lib/config/` in the same commit
