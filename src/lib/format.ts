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
