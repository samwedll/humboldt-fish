# Data Sources for Humboldt Fishing Go/No-Go Decisions

**Last updated:** May 2, 2026
**Verify each URL on first use.** Federal agencies do reorganize. If a URL 404s, search for the resource by name and update this file.

---

## Marine Weather Forecasts (NOAA / NWS)

### NWS Eureka Office (primary)
- **Marine forecast page:** <https://www.weather.gov/eka/marine>
- **Coastal waters forecast (zone PZZ450):** Pt. St. George to Cape Mendocino out to 10 nm — **THIS IS HUMBOLDT WATERS**
  - URL: <https://forecast.weather.gov/shmrn.php?mz=pzz450>
  - Direct text: <https://tgftp.nws.noaa.gov/data/forecasts/marine/coastal/pz/pzz450.txt>
- **Humboldt Bay Bar forecast (zone PZZ410):** Specific bar zone — directly relevant to bar-crossing decisions
  - URL: <https://forecast.weather.gov/shmrn.php?mz=pzz410>
- **Outer waters forecast (zone PZZ470):** Pt. St. George to Cape Mendocino, 10 to 60 nm offshore
  - URL: <https://forecast.weather.gov/shmrn.php?mz=pzz470>
- **Point forecast for Humboldt Bay entrance:** <https://forecast.weather.gov/MapClick.php?lat=40.766&lon=-124.235>

⚠️ **Do NOT use PZZ455** — that's Cape Mendocino to Pt. Arena, which is south of Humboldt (Mendocino County waters). The number PZZ450 is the right one for Humboldt.

### What to extract
- Wind direction and speed (sustained + gust)
- Wave/swell height and period
- Visibility
- Hazard statements (gale watch, small craft advisory, etc.)

**Small Craft Advisory = automatic no-go for kayak.** This is wind 21-33 kt or seas 10+ ft — well above any kayak threshold.

---

## Buoy Data (NDBC)

Real-time observations are usually more accurate than forecasts for the immediately upcoming few hours.

| Buoy | ID | Location | Use for |
|---|---|---|---|
| **Eel River** | 46022 | 17 nm WSW of Eureka | Primary offshore swell + wind |
| **Humboldt Bay** | 46244 | Near north jetty | Conditions at the bar |
| **Cape Mendocino** | 46213 | 24 nm W of Cape Mendocino | South-end offshore reference |
| **St. Georges** | 46027 | South of Crescent City | North-end reference / Crescent City trips |

### URLs
- Eel River: <https://www.ndbc.noaa.gov/station_page.php?station=46022>
- Humboldt Bay entrance: <https://www.ndbc.noaa.gov/station_page.php?station=46244>
- Cape Mendocino: <https://www.ndbc.noaa.gov/station_page.php?station=46213>

### What to extract
- WSPD (wind speed, m/s — convert to kt: m/s × 1.944)
- GST (gust speed)
- WDIR (wind direction, degrees true)
- WVHT (significant wave height, meters — convert to ft: m × 3.281)
- DPD (dominant wave period, seconds)
- MWD (mean wave direction, degrees)

---

## USCG Humboldt Bar Status

The Coast Guard issues bar restrictions for Humboldt Bay when conditions exceed safety thresholds. **This is the single most important safety check.**

- **USCG Sector Humboldt Bay:** <https://www.atlanticarea.uscg.mil/Our-Organization/District-11/District-Units/Sector-Humboldt-Bay/>
- **Bar advisory page:** Search the sector page for "bar advisory" or "bar conditions"
- **Phone:** USCG Station Humboldt Bay 707-839-6113 (verify current — historically reliable but always confirm)
- **VHF emergency:** Channel 16 (always monitor)
- **VHF bar report:** **Channel 22A** — switch here from Ch 16 for current bar advisory
- **VHF Trinidad Harbor:** **Channel 78** monitored locally for Trinidad-area advisories

### What the statuses mean
- **Open / No restrictions:** Anyone can cross
- **Restricted:** Vessels under a certain length (often 20 ft) or recreational vessels prohibited from crossing
- **Closed:** No vessel crossings

**For a kayak: any restriction = no-go. Even "small craft advisory" without a formal closure is enough to scrub the trip.**

---

## Tide Predictions (NOAA CO-OPS)

### Primary station: Humboldt Bay (North Spit)
- **Station ID:** 9418767
- **URL:** <https://tidesandcurrents.noaa.gov/stationhome.html?id=9418767>
- **Predictions:** <https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9418767>

### Secondary: Trinidad Harbor (subordinate)
- **Station ID:** 9418723 (verify on first use)
- Used for: Trinidad-launched trips

### What to extract
- Times of high and low tide for the day
- Tide heights (compare to MLLW)
- **Slack water times for bar crossing** — typically ~30 min before/after high or low

### Bar crossing rule (re-stated for emphasis)
- Cross only at slack or on a flood
- Never cross on a strong ebb, especially with west swell

---

## Salmon Season Status

- **CDFW Ocean Salmon Regulations Hotline: (707) 576-3429** — call within 2 hours of launch on any salmon trip
- CDFW Ocean Salmon page: <https://wildlife.ca.gov/Fishing/Ocean/Regulations/Salmon>
- NMFS West Coast hotline: (800) 662-9825 or (206) 526-6667
- NOAA Fisheries inseason actions: <https://www.fisheries.noaa.gov/bulletin/series/inseason-action-notice-pacific-salmon>

---

## Groundfish (Rockfish/Lingcod) Status

- CDFW Groundfish summary page: <https://wildlife.ca.gov/Fishing/Ocean/Regulations/Groundfish-Summary>
- CDFW Ocean Sport Fishing Interactive Map (for MPA boundaries): <https://wildlife.ca.gov/OceanSportfishMap>
- NOAA Pacific Coast groundfish inseason actions: <https://www.fisheries.noaa.gov/bulletin/series/inseason-action-notice-pacific-coast-groundfish>

---

## Local Reports & Bite Information

- **Fishing the North Coast (Kenny Priest):** <https://fishingthenorthcoast.com> — Best single source for local bite reports
- **Hum-Boats Sail, Canoe & Kayak Center:** <https://hum-boats.com> — Often posts bay conditions and tide notes
- **Pacific Outfitters Fishing Reports:** <https://pacificoutfitters.com> — Eureka shop, posts weekly reports
- **CCFRP (California Collaborative Fisheries Research Program):** Check for local rockfish abundance data

---

## Sun & Moon Times

- **NOAA Solar Calculator:** <https://gml.noaa.gov/grad/solcalc/>
- **timeanddate.com sunrise/sunset:** <https://www.timeanddate.com/sun/usa/eureka>
- **timeanddate.com moonrise/moonset:** <https://www.timeanddate.com/moon/usa/eureka>

For predawn launches: confirm civil twilight start (about 30 min before sunrise) — that's the earliest reasonable launch with eyes-only nav.

---

## Air Quality (occasional concern - wildfire smoke)

- **AirNow:** <https://www.airnow.gov/?city=Eureka&state=CA>
- During wildfire season (June-October typically), check before any trip. AQI > 150 = consider canceling.

---

## Driving Conditions (for Crescent City / Shelter Cove trips)

- **Caltrans QuickMap:** <https://quickmap.dot.ca.gov> — Hwy 101 and Hwy 36 conditions
- Particularly for Shelter Cove via Briceland-Thorn Rd or Wilder Ridge Rd in winter

---

## When data sources conflict

If forecast says one thing and buoy reads another:
- **Within the next 6 hours:** Trust the buoy
- **6-24 hours out:** Trust the forecast, but with a wider error band
- **24+ hours out:** Treat as planning-only, re-verify within 24 hours of launch

If two forecasts disagree (e.g., NWS vs. a third-party app):
- Use NWS as authoritative for Humboldt waters
- The Eureka office knows the local geography better than national models
