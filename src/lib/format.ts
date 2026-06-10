/**
 * Display-time helpers. All user-facing times in this app are Pacific local
 * (Sam fishes from Humboldt County, CA), so we format Dates / ISO strings
 * through `Intl.DateTimeFormat` with `timeZone: 'America/Los_Angeles'` —
 * which automatically handles PST/PDT seasonal transitions.
 */

const PACIFIC_HHMM = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

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
 * Format a Date or ISO string as "HH:MM PT" in Pacific time.
 *
 * Example: formatPacificTime('2026-05-18T12:51:00Z') → "05:51 PT"
 * (during PDT; would be "04:51 PT" in PST).
 */
export function formatPacificTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${PACIFIC_HHMM.format(date)} PT`;
}

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

/**
 * Inverse of toPacificLocalISO: convert a Pacific-local "YYYY-MM-DDTHH:MM"
 * string (the TidalCurrentEvent.time format) to epoch ms. The PT offset
 * depends on the instant (PST vs PDT), so start from a UTC guess and correct
 * by re-rendering; two passes settle every case except the ambiguous/skipped
 * hour at a DST transition (02:00–03:00, never a launch-relevant time here).
 */
export function ptLocalIsoToEpochMs(iso: string): number {
  let guess = Date.parse(`${iso}:00Z`);
  for (let i = 0; i < 2; i++) {
    const rendered = toPacificLocalISO(new Date(guess));
    const diff = Date.parse(`${iso}:00Z`) - Date.parse(`${rendered}:00Z`);
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
}
