# Handoff: Kicking off the Humboldt Fishing Checker

*Read this once at session start, then this doc can be ignored. CLAUDE.md is the durable project context.*

---

## How this project came to be

The user and Claude.ai have been building a kayak fishing operation for the 2026 Humboldt season — a specific 14-foot pedal kayak, calibrated thresholds, a four-layer go/no-go decision framework, structured CDFW regulation files. The decision framework lives as a skill at `/mnt/skills/user/humboldt-fishing-go-nogo/` in Claude.ai and has been copied verbatim into `reference/` here.

The framework works well **when the data is fresh**. The problem we hit, repeatedly, is that the Claude.ai chat environment fetches federal data sources (NOAA, NWS, NDBC) through a caching layer that often returns days-old responses. This morning's example:

- The user asked: "What does fishing look like tomorrow morning and the rest of the week?"
- Claude.ai web_fetch on buoy 46244: returned May 8 data on May 17
- Claude.ai web_fetch on the NWS Eureka CWF: returned a May 4 issuance
- The user looked outside, saw clear sky and light wind, said "it seems perfect this morning"
- The user pulled buoy 46244 on a phone: **10.5 ft significant wave height at 11 sec, WNW** — a hard NO-GO that the cached forecasts missed
- The Pacific deception is real and the cache problem hides it from chat-side Claude

Claude Code running on the user's Fedora dev box doesn't have this problem. `bash_tool` and `web_fetch` hit NOAA from local network. The user's existing `bootstrap-toolkit` skill means jq, curl, and ripgrep are already in place. This project ports the decision framework to that environment.

## What to build in Phase 1

A Python CLI that takes a target species (default rockfish) and a date (default "tomorrow"), pulls live data from NOAA, applies the user's thresholds, and renders the four-layer table to stdout using the canonical format in `reference/decision-template.md`.

### Minimum viable command shape

```
hfc                                  # tomorrow, rockfish, Trinidad (current best default)
hfc --species lingcod --date 2026-05-19
hfc --launch lagoon                  # bypass Layer 2 — lagoons are tide- and swell-immune
hfc --week                           # 7-day outlook table
```

### Phase 1 explicit non-goals

- **No zip code generalization yet.** Phase 1 is Humboldt-only. The data-source URLs in `reference/data-sources.md` are hardcoded for this region. Generalization is Phase 2.
- **No web UI.** Terminal output only.
- **No MCP server.** That's Phase 3.
- **No bait-shop scraping or Kenny Priest's blog.** Useful for sanity-check during code review, not in v1.
- **No "smart" interpretation of marginal conditions.** Thresholds are hard. If the numbers say NO-GO, say NO-GO.

### Data sources to wire up first (priority order)

1. **NDBC buoy 46244** (Humboldt Bay North Spit Waverider) — significant wave height, dominant period, mean wave direction, water temp. This is the single highest-value live signal because it's the one that lied during this morning's debrief.
2. **NWS CWF for zone PZZ450** (Pt. St. George to Cape Mendocino, out 10 nm) — wind speed/direction, hazard statements (SCA, gale watch, hazardous seas warning)
3. **NWS CWF for zone PZZ410** (Humboldt Bay Bar) — relevant for completeness even though the user never crosses it; useful as a proxy for general bar-area conditions
4. **NOAA tide predictions** for station 9418767 (Humboldt Bay, North Spit) — used for slack times and bay-launch planning
5. **NWS Area Forecast Discussion (AFDEKA)** — useful synoptic narrative, not strictly required for the verdict but adds context to multi-day outlooks
6. **Sunrise/sunset** for Eureka — civil twilight defines earliest launchable time
7. **USCG Humboldt Bar advisory** — even though the user doesn't cross the bar, the advisory status is a useful general-conditions tell. This one is the hardest to fetch programmatically; OK to defer to Phase 2 if needed.

The endpoint specifics (URL shapes, station IDs, what to parse) are in `reference/data-sources.md`. If you find any URL there has rotted, fix it and note the change in a `CHANGES.md` so the user can fold the update back into the canonical skill.

### Output format

Use the table in `reference/decision-template.md` as the canonical structure. Terminal rendering can use plain markdown — the user reads it in the terminal fine and can pipe to glow/mdcat if they want pretty rendering later.

### Reading-the-skill checklist before writing any code

The skill is the contract for what "correct" means. Read these in order, in full:

- [ ] `reference/SKILL.md` — when the framework triggers, the layer ordering, fail-stop logic, conservatism notes
- [ ] `reference/context.md` — the user's identity, boat, gear, license, target species priorities
- [ ] `reference/thresholds.md` — the actual numbers, the solo-vs-accompanied table, the predawn rules, the two permanent user rules
- [ ] `reference/data-sources.md` — endpoints, conflict-resolution rules, the PZZ450-vs-PZZ455 gotcha (PZZ455 is the wrong zone, do not use)
- [ ] `reference/launches.md` — launch tiers, the launch selection decision tree, the personal rules at the top that override everything else
- [ ] `reference/decision-template.md` — the output format and verdict logic
- [ ] `reference/regs/rockfish-lingcod-2026-northern.md` — current season is open all depths Apr 1 – Dec 31, descender required, 4-vermilion sub-limit specific to Northern Mgmt Area
- [ ] `reference/regs/salmon-2026-kmz.md` — open Jun 13 – Jul 19 and Aug 1 – Aug 31; call (707) 576-3429 hotline

### Sanity-test endpoints before writing application code

The user works direct-first. Before you write a Python module that wraps NOAA in a bunch of abstraction, just curl the endpoints in bash and confirm what comes back:

```bash
curl -s "https://www.ndbc.noaa.gov/data/realtime2/46244.txt" | head -20
curl -s "https://api.weather.gov/zones/forecast/PZZ450/forecast" | jq '.properties.periods[0:6]'
curl -s "https://api.tides.noaa.gov/api/prod/datagetter?date=today&station=9418767&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json" | jq '.predictions[0:4]'
```

If those work, the architecture is just: one fetcher per source, normalize to a dict, run the four-layer check, render. Don't over-abstract.

### CORS

Not a concern in Phase 1 — we're running in bash/Python, not browser. Note it for Phase 2.

### Known gaps (acceptable in Phase 1)

- USCG bar advisory page has no clean machine-readable feed last we checked. Acceptable to display "verify via VHF 22A or call 707-839-6113" in the output rather than scrape the page.
- Visibility/fog forecast is in the AFDEKA prose, not in a clean field — natural-language extract is fine; if uncertain, mark the layer as "?" rather than guess.

## After Phase 1 boots

When the CLI works end-to-end for tomorrow's verdict:

1. Have the user run it a few times over a week. Note any edge cases where the verdict feels wrong.
2. Then move to Phase 2: HTML/JS frontend that calls the same data sources from the browser. Zip-code input. Deploy to Cloudflare Pages.
3. Then Phase 3: wrap the Python core as an MCP server. The user adds it as a custom connector in Claude.ai. The cache problem is permanently solved for chat-side use.

## First session, suggested opening move

```
1. Read CLAUDE.md fully.
2. Read every file under reference/ in the order listed in CLAUDE.md.
3. Curl the three sanity-check endpoints above and show me what comes back.
4. Sketch the module structure (don't write code yet). Aim for ≤5 modules.
5. We'll review the sketch, then start writing.
```
