/**
 * Mirror of reference/data-sources.md.
 * Source of truth is the markdown; this is the runtime copy.
 * When reference/data-sources.md changes, update this file in the same commit.
 *
 * Per data-sources.md: PZZ450 is Humboldt waters (NOT PZZ455). Primary tide
 * station is 9418767 (Humboldt Bay North Spit). NDBC 46244 is the bar-entrance
 * buoy; NDBC 46022 (Eel River) is the offshore reference.
 */
export interface SourceDef {
  label: string;
  url: string;
  ttlSec: number;
}

export interface NwsPointSource {
  label: string;
  pointUrl: (lat: number, lon: number) => string;
  ttlSec: number;
}

export interface TidesSourceDef {
  label: string;
  station: string;
  url: (station: string, beginDate: string, endDate: string) => string;
  ttlSec: number;
}

export interface CurrentsSourceDef {
  label: string;
  defaultStation: string;
  url: (station: string, beginDate: string, endDate: string) => string;
  ttlSec: number;
}

export const sources = {
  ndbc46244: {
    label: 'NDBC 46244 (Humboldt Bay)',
    url: 'https://www.ndbc.noaa.gov/data/realtime2/46244.txt',
    ttlSec: 600
  } as SourceDef,

  ndbc46022: {
    label: 'NDBC 46022 (Eel River)',
    url: 'https://www.ndbc.noaa.gov/data/realtime2/46022.txt',
    ttlSec: 600
  } as SourceDef,

  nwsZone: {
    label: 'NWS Marine PZZ450 (via CWF text product)',
    zone: 'PZZ450',
    office: 'EKA',
    ttlSec: 3600
  } as { label: string; zone: string; office: string; ttlSec: number },

  nwsPoint: {
    label: 'NWS Point Forecast (Trinidad)',
    pointUrl: (lat, lon) => `https://api.weather.gov/points/${lat},${lon}`,
    ttlSec: 3600
  } as NwsPointSource,

  tides: {
    label: 'NOAA Tides 9418767',
    station: '9418767',
    url: (station, beginDate, endDate) =>
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=predictions&application=humboldt.fish&` +
      `begin_date=${beginDate}&end_date=${endDate}&` +
      `datum=MLLW&station=${station}&time_zone=lst_ldt&units=english&` +
      `interval=hilo&format=json`,
    ttlSec: 86400
  } as TidesSourceDef,

  currents: {
    label: 'NOAA Tidal Currents (HUB0203)',
    defaultStation: 'HUB0203',
    url: (station, beginDate, endDate) =>
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
      `product=currents_predictions&application=humboldt.fish&` +
      `begin_date=${beginDate}&end_date=${endDate}&` +
      `station=${station}&time_zone=lst_ldt&interval=max_slack&` +
      `units=english&format=json`,
    ttlSec: 86400
  } as CurrentsSourceDef
};

// reference/data-sources.md: USCG Station Humboldt Bay bar recorder
// Exported separately (not in `sources`) because it is a contact, not a
// polled data source, and sources.test.ts asserts every sources entry has ttlSec.
export const barStatus = { label: 'USCG Station Humboldt Bay', phone: '707-839-6113', vhf: '22A' } as const;

export const USER_AGENT = 'humboldt.fish (https://humboldt.fish)';
