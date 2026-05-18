import type {
  FetchedData,
  NdbcObservation,
  NwsZoneForecast,
  NwsPointForecast,
  TidePredictions,
  SunTimes,
  Species,
  LaunchId,
  Verdict,
  VerdictResponse
} from '../types.js';
import type { FetchResult } from '../fetchers/ndbc.js';
import { computeVerdict } from '../verdict/computeVerdict.js';

export interface Fetchers {
  ndbc46244: () => Promise<FetchResult<NdbcObservation>>;
  ndbc46022: () => Promise<FetchResult<NdbcObservation>>;
  nwsZone: () => Promise<FetchResult<NwsZoneForecast>>;
  nwsPoint: () => Promise<FetchResult<NwsPointForecast>>;
  tides: () => Promise<FetchResult<TidePredictions>>;
  suntimes: (dates: string[]) => SunTimes;
}

export interface OrchestrateInput {
  species: Species;
  launch: LaunchId;
  days: number;
  today: string;
  fetchers: Fetchers;
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function orchestrateVerdict(input: OrchestrateInput): Promise<VerdictResponse> {
  const { species, launch, days, today, fetchers } = input;
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(addDays(today, i));

  const [ndbc1, ndbc2, zone, point, tides] = await Promise.all([
    fetchers.ndbc46244(),
    fetchers.ndbc46022(),
    fetchers.nwsZone(),
    fetchers.nwsPoint(),
    fetchers.tides()
  ]);
  const suntimes = fetchers.suntimes(dates);

  const data: FetchedData = {
    ndbc46244: ndbc1.ok ? ndbc1.data! : null,
    ndbc46022: ndbc2.ok ? ndbc2.data! : null,
    nwsZone: zone.ok ? zone.data! : null,
    nwsPoint: point.ok ? point.data! : null,
    tides: tides.ok ? tides.data! : null,
    tidalCurrents: null,
    suntimes
  };

  const verdicts: Verdict[] = dates.map((date) =>
    computeVerdict({ date, today, species, launch, data })
  );

  return {
    generatedAt: new Date().toISOString(),
    freshness: {
      ndbc46244: ndbc1.ok ? ndbc1.fetchedAt : undefined,
      ndbc46022: ndbc2.ok ? ndbc2.fetchedAt : undefined,
      nwsZone: zone.ok ? zone.fetchedAt : undefined,
      nwsPoint: point.ok ? point.fetchedAt : undefined,
      tides: tides.ok ? tides.fetchedAt : undefined,
      suntimes: new Date().toISOString()
    },
    days: verdicts
  };
}
