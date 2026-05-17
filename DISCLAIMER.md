# Disclaimer

This codebase implements decision logic calibrated for one specific person's kayak fishing setup in one specific region (Humboldt County, California). The thresholds, permanent rules, launch list, and decision framework are NOT safe defaults for anyone else.

## What this is

A personal tool, made public so that the source-of-truth for any decisions the live site renders is auditable. The reference files in `reference/` are the actual basis for every verdict the site produces. They are documented, dated, and citable.

## What this is not

- A general-purpose fishing decision tool
- Calibrated for any boat other than a specific 14-foot pedal kayak
- Calibrated for any immersion-protection system other than a specific semi-dry layering setup
- Calibrated for anyone with significant ocean kayak fishing experience or any with materially less
- A substitute for USCG bar advisories (707-839-6113 or VHF Channel 22A)
- A substitute for CDFW salmon hotline status (707-576-3429)
- A substitute for on-the-water judgment at the launch ramp

## If you want to fork this

Recalibration is not optional. Every threshold in `reference/thresholds.md`, every entry in `reference/launches.md`, every permanent rule, and every piece of activity-specific gear guidance is shaped by one specific person's situation. Forking and changing the deployment URL without recalibration ships a tool that will produce confident verdicts based on someone else's body, boat, and water — which is dangerous in a way the original isn't.

If you're interested in the *methodology* (live data + curated thresholds + four-layer fail-stop decision framework + permanent user rules), the methodology generalizes. The specific values do not.

## On contributions

This repo will not accept issues or pull requests that assume general-purpose use. Bug fixes to the decision logic for the one person it's calibrated for are welcome. Feature requests for "make it work for my boat" / "support my region" / "add my favorite species" will be politely closed — that work belongs in a fork, with full recalibration, under a different name and URL.

## On data sources

This site fetches live data from NOAA (NWS, NDBC), and references CDFW regulations as of the date noted in each `reference/regs/` file. Data freshness is displayed in the UI; regulation freshness requires manual verification before each trip. Source endpoints can change without notice.
