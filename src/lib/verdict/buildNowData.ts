import type { FetchedData, LaunchId, NowData } from '../types.js';
import { getLaunch } from '../config/launches.js';

/**
 * Assemble the NowData block for today's verdict. Pure projection of already-
 * fetched data into machine-readable timestamps — no new fetches, no clock.
 * Returns undefined when suntimes are missing (can't anchor any temporal gate).
 */
export function buildNowData({
  date,
  launch,
  data
}: {
  date: string;
  launch: LaunchId;
  data: FetchedData;
}): NowData | undefined {
  const sun = data.suntimes.byDate[date];
  if (!sun) return undefined;
  const profile = getLaunch(launch);

  const nowData: NowData = {
    date,
    dawnMs: Date.parse(sun.civilDawn),
    duskMs: Date.parse(sun.civilDusk)
  };
  if (profile.openOcean && data.ndbc46244) {
    nowData.buoy = { ...data.ndbc46244, observedAtMs: Date.parse(data.ndbc46244.observedAt) };
  }
  if (profile.currentStation && data.tidalCurrents) {
    nowData.tidalCurrents = data.tidalCurrents;
  }
  if (data.nwsPoint) {
    nowData.pointPeriods = data.nwsPoint.periods.map((p) => ({
      startMs: Date.parse(p.startTime),
      endMs: Date.parse(p.endTime),
      windSpeed: p.windSpeed,
      windDirection: p.windDirection
    }));
  }
  return nowData;
}
