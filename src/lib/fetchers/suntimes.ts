import SunCalc from 'suncalc';
import type { SunTimes } from '../types.js';

export function computeSunTimes(dates: string[], lat: number, lon: number): SunTimes {
  const byDate: SunTimes['byDate'] = {};
  for (const d of dates) {
    // Use solar-noon-ish UTC time for the requested date to ensure SunCalc picks the right day
    // at this longitude (~PDT is UTC-7; 20:00 UTC = 13:00 local).
    const noon = new Date(`${d}T20:00:00Z`);
    const t = SunCalc.getTimes(noon, lat, lon);
    byDate[d] = {
      civilDawn: t.dawn.toISOString(),
      sunrise: t.sunrise.toISOString(),
      sunset: t.sunset.toISOString(),
      civilDusk: t.dusk.toISOString()
    };
  }
  return { byDate };
}
