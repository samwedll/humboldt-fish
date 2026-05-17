# Humboldt Fishing Checker

A tool that answers "should I fish tomorrow?" by pulling live NOAA marine data and applying the user's personal thresholds and decision framework.

## Read first

The canonical reference for this project lives in **`reference/`** — it's a verbatim copy of the `humboldt-fishing-go-nogo` skill from Claude.ai. Before doing anything substantive, read in this order:

1. **`reference/SKILL.md`** — the four-layer decision framework (Legal → Safety → Quality → Logistics) and how it gets applied
2. **`reference/context.md`** — who the user is, the boat (a specific 14-foot pedal kayak), license/gear inventory, local resources
3. **`reference/thresholds.md`** — the user's personal go/no-go numbers (wind, swell, period, etc.) and the user-set permanent rules (no Humboldt bar crossing ever; Trinidad-only for open ocean)
4. **`reference/data-sources.md`** — every API endpoint, buoy ID, NWS zone, tide station, and hotline number, with notes on which to trust when they conflict
5. **`reference/launches.md`** — launch sites by tier and the decision tree for matching conditions to launch
6. **`reference/decision-template.md`** — the canonical output format for go/no-go decisions
7. **`reference/regs/`** — current-season regulation files for rockfish/lingcod and salmon

## Why this project exists

The skill works fine when Claude has live access to NOAA APIs. In Claude.ai chat, the data-fetch path goes through a caching layer that serves federal endpoints stale (sometimes days old). On the user's Fedora dev box running Claude Code, `web_fetch` and `bash` execute from local network — direct hits to NOAA APIs, no cache, fresh data every time.

This tool runs on the user's dev box and gives them a green/yellow/red call with the four-layer table populated from live readings. Later it gets promoted to a web UI and eventually an MCP server that Claude.ai can call back to.

## Project conventions

- **Reference files are read-only inside Claude Code sessions** — they are the canonical domain knowledge. Updates to thresholds, launches, regs etc. happen in conversation with Claude.ai (where the skill lives), then get copied back into `reference/`. Do not edit them from within this project unless explicitly asked.
- **Code lives outside `reference/`** — typically `src/` for Python, `web/` if/when a frontend is added.
- **Conservative defaults are not negotiable in-conversation.** If a threshold says ≤5 ft swell, the verdict is NO-GO at 5.1 ft. The user wrote the thresholds to bind future-self. Don't soften them at runtime.
- **For solo trips outside Humboldt jetties: always NO-GO** in year-1 ocean regardless of conditions. This is in `thresholds.md` and is permanent until the user edits the file.
- **Two hardcoded user rules** (in `launches.md` and `thresholds.md`):
  - No Humboldt Bay jetty crossings, ever. Not unlocked by good bar reports or future skill.
  - Trinidad is the only open-Pacific launch.
- **Verdict logic**: any Layer 1 ✗ → NO-GO; any Layer 2 ✗ → NO-GO; ≥2 Layer 2 ⚠ → CONDITIONAL with explicit bailout plan; all green → GO.
- **Always end GO/CONDITIONAL output with**: "Verify the bar status and salmon hotline within 2 hours of launch. Conditions can change fast on the North Coast."

## Current phase

See `HANDOFF.md` for the kickoff prompt and Phase 1 scope. The phased plan in brief:

- **Phase 1 (current)**: Python CLI on the user's dev box. Takes a target species + date (or "tomorrow"), pulls live NOAA data, renders the four-layer table to terminal.
- **Phase 2**: Static HTML/JS frontend for mobile use, deployed to Cloudflare Pages or similar. Accepts a zip code so the data layer generalizes.
- **Phase 3**: Wrap as an MCP server so Claude.ai chat can call it as a connector — permanent fix for the caching problem.

## Tech preferences (the user's style)

- Python for CLI work (stdlib + requests; only add deps when they pay rent)
- Direct API calls over MCP wrappers when MCP adds no abstraction
- Plain markdown for human-readable output; rich/click only if it earns its keep
- Skill-style structured docs (hotline numbers, source citations, update schedules, explicit "known gaps")
- Check local options before reaching for cloud infra
