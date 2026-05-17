---
name: humboldt-fishing-go-nogo
description: Make go/no-go decisions for kayak fishing trips out of Humboldt County (Blue Lake, Arcata, Eureka, Trinidad, Crescent City, Shelter Cove). Use whenever the user asks whether to fish on a specific day, asks about marine conditions in a fishing context, asks "should I launch", "is the bar open", "is it fishable", "is X in season", asks for gear recommendations for an upcoming kayak trip, mentions targeting a Humboldt species (lingcod, rockfish, salmon, Pacific halibut, California halibut, cabezon, surfperch, jacksmelt, Dungeness crab) on a specific date, or describes an upcoming trip that would benefit from a conditions check. Always run this skill — even if a single web search would seem to answer — because the integrated four-layer check (Legal → Safety → Quality → Logistics) catches dependencies a single search misses.
---

# Humboldt Fishing Go/No-Go Skill

A four-layer decision framework for deciding whether to launch a kayak from Humboldt County, what to target, and what to bring. Conservative defaults calibrated for a new-to-Pacific kayak angler in cold water.

## When this skill triggers

Run this skill whenever the user asks any variation of:
- "Should I fish [date/time]?"
- "What's the outlook for [day]?"
- "Is the bar open?" / "Is it fishable?"
- "Should I target [species] this weekend?"
- "What should I bring for tomorrow's trip?"
- Or describes a planned trip in a way that would benefit from a conditions check.

## The four-layer decision framework

Run the layers in order. **Each layer can fail-stop the decision.** Don't skip ahead.

1. **Legal** — Is the target species in season? Is the launch in/out of an MPA? Are required cards/licenses current?
2. **Safety** — Can the user safely launch and return? Bar, wind, swell, swell period, fog, water temp.
3. **Quality** — Is it actually worth going? Tide stage, bite windows, recent reports.
4. **Logistics** — Which launch, what gear, what backup, when to leave.

If Layer 1 fails → **NO-GO**. Stop. Don't bother with safety/quality.
If Layer 2 fails → **NO-GO**. Quality and logistics don't matter if the launch isn't safe.
If Layer 2 is marginal (any single threshold within 20% of fail) → **CONDITIONAL** with explicit bailout plan.
If all four layers pass → **GO** with gear/timing/launch recommendations.

## Workflow when triggered

### Step 0: Load context

**Always read `context.md` first** when this skill triggers. It contains the user's region, boat (a specific 14-foot pedal kayak — wide and stable), safety gear inventory (a specific semi-dry layering system, NOT a drysuit), shore contact, license status, and target species. This is the single source of truth for the user's setup. Decisions should reference it.

### Step 1: Establish the window

Identify the date(s) and time window. If the user said "this weekend," ask which day(s) or default to both Sat/Sun. If they said "tomorrow," confirm the date. If a multi-day range, run the framework once per day and present a side-by-side.

### Step 2: Read the personal thresholds

Read `thresholds.md` from this skill folder. These are the user's personal go/no-go numbers. Apply them in Layer 2. If the user has updated them since this skill was last edited, the file is the source of truth.

### Step 3: Run Layer 1 (Legal)

For the target species (or if unspecified, the most likely candidates given the season):

- Read the relevant file from `regs/`:
  - Salmon → `regs/salmon-2026-kmz.md`
  - Rockfish/lingcod → `regs/rockfish-lingcod-2026-northern.md`
  - Halibut, surfperch, sturgeon, etc. → file may not yet exist; flag as a TODO and use a web search to fill the gap (see "Known gaps" below)

- Confirm:
  - Is the season open on the target date?
  - Are the user's licenses/cards current? (If unknown, ask once and remember for the session.)
  - Is the planned launch/fishing area inside an MPA? (Use the CDFW Ocean Sport Fishing Interactive Map: <https://wildlife.ca.gov/OceanSportfishMap>)

- For salmon specifically: **Always note the (707) 576-3429 hotline as the final word** because the season can close inseason without warning.

### Step 4: Run Layer 2 (Safety)

Pull live data from each source in `data-sources.md`. Specifically:

1. **NOAA marine forecast** for the relevant zone (PZZ450 for Humboldt waters out to 10 nm; PZZ410 for the Humboldt Bay Bar specifically; PZZ470 for 10-60 nm offshore). **Note: PZZ455 is the wrong zone — that's south of Humboldt.**
2. **NDBC buoy data** — at minimum check buoy 46022 (Eel River) and 46244 (Humboldt Bay entrance) for wind and swell
3. **USCG Humboldt Bar status** — check sector Humboldt Bay's bar advisory page
4. **NOAA tide predictions** for Humboldt Bay station 9418767 — get high/low/slack times for the day
5. **Visibility/fog forecast** from NWS Eureka

Compare each pulled value against the threshold in `thresholds.md`. Build the safety row of the output table.

### Step 5: Run Layer 3 (Quality)

- **Tide stage at intended fishing time:** Most rockfish/lingcod kayak anglers prefer the slack-to-flooding transition. Salmon trolling cares less about tide.
- **Wind direction vs. swell direction:** Aligned (within 45°) is good; opposing is dangerous chop.
- **Sun times:** From NOAA Solar Calculator or `timeanddate.com`. Note sunrise, civil twilight, and sunset.
- **Recent reports:** Check fishingthenorthcoast.com (Kenny Priest's reports) and the Hum-Boats / Pacific Outfitters Facebook pages for what's been biting in the last 3-7 days.

### Step 6: Run Layer 4 (Logistics)

- **Launch recommendation:** Read `launches.md`. Match conditions to launch — Trinidad Harbor for marginal-but-not-no-go days, outside the Humboldt jetties only when conditions are solidly green.
- **Target species recommendation:** Based on what's in season, what's been biting, and what conditions allow.
- **Gear recommendation:** Read `gear-recommendations.md`. Pull the recommendation block for the day's target species and conditions.
- **Departure timing:** Work back from slack tide / first light / target fishing window.

### Step 7: Output

Use the structured format in `decision-template.md`. Always include:

1. **Verdict line** at top: `GO` / `CONDITIONAL: <reason>` / `NO-GO: <reason>`
2. **Four-layer table** showing each check, status, and notes
3. **Gear pack list** (only if GO or CONDITIONAL)
4. **Bailout plan** (only if CONDITIONAL — what changes flip it to no-go)
5. **Sources & freshness** — when each data point was pulled, with a "verify before launch" reminder for hotline-driven items (salmon season status, bar status)

### Step 8: Final reminder

End every GO/CONDITIONAL output with: "Verify the bar status and salmon hotline within 2 hours of launch. Conditions can change fast on the North Coast."

## Known gaps (TODO regs files)

These regs files don't exist yet. When the user asks about these species, either build the file inline or search the web and caveat that the answer isn't from a curated source:

- **Pacific halibut** — Season is open April 1 – Nov 15, 2026 with a quota; report card required. Build `regs/pacific-halibut-2026.md` next.
- **Surfperch / jacksmelt** — No closed season generally but check size/bag.
- **Sturgeon (Humboldt Bay)** — Usually closed; verify before targeting.
- **Steelhead (Mad River, Smith River)** — Report card required; specific sections and dates.
- **Crab (Dungeness, sport)** — Season Nov 1 – July 30 typically; hoop net rules.
- **Licenses & cards general** — Sport license, ocean enhancement, halibut card, steelhead card.
- **General gear rules** — Hook count, barbless, descending devices.

## Conservatism notes

This skill is calibrated for **the user — an experienced freshwater paddler in their first ocean kayak fishing season, on a specific 14-foot pedal kayak (a notably stable platform), with a specific semi-dry layering system (not a full drysuit)**. Default thresholds are deliberately tight for ocean exposure, looser for protected water (the user has the paddling skill for protected lagoons and inside-bay regardless of ocean newness). As experience grows, the user should edit `thresholds.md` to reflect actual ocean capability. **Do not relax thresholds in-conversation without the user explicitly editing the file.** A conversation-only override defeats the purpose of having written thresholds.

For solo trips outside Humboldt jetties, **always recommend NO-GO** in year-1-ocean regardless of conditions. The user can override with explicit acknowledgment, but the default is no.

The PA-14's 38" beam and 600 lb capacity make it nearly impossible to flip in non-extreme conditions, but the immersion-protection layering system (vs. full drysuit) means time-in-water tolerance is shorter. Outside-jetty thresholds reflect this — rescue must be reachable within ~15-20 min of immersion in 50-55°F water.

## What this skill does NOT do

- It does not replace the actual go/no-go decision the user makes at the launch ramp. Conditions can change in the hour between this analysis and putting the kayak in the water.
- It does not have the authority of the CDFW hotlines, USCG bar advisories, or NOAA forecasts. It synthesizes them.
- It does not know about emergency closures issued in the last few hours. Always tell the user to verify with the salmon hotline and USCG bar status within 2 hours of launch.
