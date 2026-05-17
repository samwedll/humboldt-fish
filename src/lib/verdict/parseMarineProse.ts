/**
 * Parser for NWS Coastal Waters Forecast (CWF) prose periods.
 *
 * The CWF text product (e.g. PZZ450) emits period-by-period free-form text
 * like "N wind 20 to 25 kt with gusts up to 35 kt. Seas 8 ft. Wave Detail:
 * NW 8 ft at 9 seconds and NW 2 ft at 17 seconds.". This module extracts
 * the numeric fields needed for Safety-layer threshold evaluation on future
 * days (when no NDBC buoy observation exists yet).
 */

export interface MarineProseParsed {
  windDirAbbr?: string;
  windDirDeg?: number;
  windLowKt?: number;
  windHighKt?: number;
  gustKt?: number;
  seasFt?: number;
  swellDirAbbr?: string;
  swellDirDeg?: number;
  swellHtFt?: number;
  swellPeriodSec?: number;
}

const COMPASS_TO_DEG: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5
};

// "with gusts up to N kt" or "with gusts to N kt" (no "up")
const GUST_SUFFIX = /(?:\s+with\s+gusts?\s+(?:up\s+)?to\s+(\d+)\s+kt)?/i.source;

export function parseMarineProse(text: string): MarineProseParsed {
  const out: MarineProseParsed = {};

  // Wind shape 1: "<DIR> winds? <low> to <high> kt [gusts]"
  const rangeForm = new RegExp(
    `(\\b[NSEW]{1,3}\\b)\\s+winds?\\s+(\\d+)\\s+to\\s+(\\d+)\\s+kt${GUST_SUFFIX}`,
    'i'
  );
  // Wind shape 2: "Winds? becoming <DIR> <low> to <high> kt [gusts]"
  const becomingRangeForm = new RegExp(
    `winds?\\s+becoming\\s+(\\b[NSEW]{1,3}\\b)\\s+(\\d+)\\s+to\\s+(\\d+)\\s+kt${GUST_SUFFIX}`,
    'i'
  );
  // Wind shape 3 (single value, prefix): "<DIR> winds? <kt> kt [gusts]"
  const singleForm = new RegExp(
    `(\\b[NSEW]{1,3}\\b)\\s+winds?\\s+(\\d+)\\s+kt${GUST_SUFFIX}`,
    'i'
  );
  // Wind shape 4 (single value, becoming): "Winds? becoming <DIR> <kt> kt [gusts]"
  const becomingSingleForm = new RegExp(
    `winds?\\s+becoming\\s+(\\b[NSEW]{1,3}\\b)\\s+(\\d+)\\s+kt${GUST_SUFFIX}`,
    'i'
  );

  const rangeMatch = text.match(rangeForm) ?? text.match(becomingRangeForm);
  if (rangeMatch) {
    out.windDirAbbr = rangeMatch[1].toUpperCase();
    out.windDirDeg = COMPASS_TO_DEG[out.windDirAbbr];
    out.windLowKt = Number(rangeMatch[2]);
    out.windHighKt = Number(rangeMatch[3]);
    if (rangeMatch[4]) out.gustKt = Number(rangeMatch[4]);
  } else {
    const singleMatch = text.match(singleForm) ?? text.match(becomingSingleForm);
    if (singleMatch) {
      out.windDirAbbr = singleMatch[1].toUpperCase();
      out.windDirDeg = COMPASS_TO_DEG[out.windDirAbbr];
      out.windLowKt = Number(singleMatch[2]);
      out.windHighKt = Number(singleMatch[2]);
      if (singleMatch[3]) out.gustKt = Number(singleMatch[3]);
    }
  }

  // Seas: capture the whole "Seas …" sentence and take the largest "<n> ft" in it.
  // Handles "Seas 8 ft", "Seas around 5 ft", "Seas 4 to 6 ft", "Seas 5 ft or less",
  // and "Seas 5 to 7 ft, building to 10 ft tonight" — always picking the highest
  // for safety.
  const seasSentence = text.match(/Seas[^.]*\./i)?.[0];
  if (seasSentence) {
    const ftValues = [...seasSentence.matchAll(/(\d+)\s+ft/gi)].map((m) => Number(m[1]));
    if (ftValues.length > 0) out.seasFt = Math.max(...ftValues);
  }

  // First "Wave Detail" component: "Wave Detail: <DIR> <ft> ft at <sec> seconds"
  const swellMatch = text.match(
    /Wave\s+Detail:\s+(\b[NSEW]{1,3}\b)\s+(\d+)\s+ft\s+at\s+(\d+)\s+seconds/i
  );
  if (swellMatch) {
    out.swellDirAbbr = swellMatch[1].toUpperCase();
    out.swellDirDeg = COMPASS_TO_DEG[out.swellDirAbbr];
    out.swellHtFt = Number(swellMatch[2]);
    out.swellPeriodSec = Number(swellMatch[3]);
  }

  return out;
}

/**
 * Parse a NWS point-forecast period's wind fields ("15 to 24 mph" + "NNW")
 * into structured kt values + degrees. mph→kt is × 0.868976.
 */
const MPH_TO_KT = 0.868976;

export function parsePointWind(
  windSpeed: string,
  windDirection: string
): { lowKt?: number; highKt?: number; dirAbbr?: string; dirDeg?: number } {
  let lowKt: number | undefined;
  let highKt: number | undefined;
  const range = windSpeed.match(/(\d+)\s+to\s+(\d+)\s+mph/i);
  if (range) {
    lowKt = Number(range[1]) * MPH_TO_KT;
    highKt = Number(range[2]) * MPH_TO_KT;
  } else {
    const single = windSpeed.match(/(\d+)\s+mph/i);
    if (single) {
      lowKt = Number(single[1]) * MPH_TO_KT;
      highKt = lowKt;
    }
  }
  const dirAbbr = windDirection?.toUpperCase().trim();
  const dirDeg = dirAbbr && dirAbbr in COMPASS_TO_DEG ? COMPASS_TO_DEG[dirAbbr] : undefined;
  return { lowKt, highKt, dirAbbr, dirDeg };
}

/**
 * Find the NwsPointPeriod that matches a target date in Pacific time,
 * preferring the daytime period. Returns undefined if none matches.
 */
export function findPointPeriodForDate<T extends { startTime: string; isDaytime: boolean }>(
  periods: T[],
  date: string
): T | undefined {
  for (const p of periods) {
    if (!p.isDaytime) continue;
    const startPacific = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(p.startTime));
    if (startPacific === date) return p;
  }
  return undefined;
}

/**
 * Derive the calendar date for each NwsZonePeriod by assuming the standard
 * alternating CWF pattern: index 0 = issuance date daytime, 1 = night,
 * 2 = next day daytime, 3 = next day night, etc.
 *
 * Returns the date in Pacific local time as YYYY-MM-DD and isDaytime.
 */
export function deriveDateForPeriod(
  periodIndex: number,
  issuanceTime: string
): { date: string; isDaytime: boolean } {
  const offsetDays = Math.floor(periodIndex / 2);
  const isDaytime = periodIndex % 2 === 0;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const baseDate = fmt.format(new Date(issuanceTime)); // YYYY-MM-DD
  const d = new Date(baseDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return { date: d.toISOString().slice(0, 10), isDaytime };
}
