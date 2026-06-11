export type Species =
  | 'rockfish'
  | 'lingcod'
  | 'salmon'
  | 'surfperch'
  | 'cutthroat'
  | 'california-halibut'
  | 'dungeness-crab'
  | 'pacific-halibut'
  | 'albacore-tuna'
  | 'bluegill'
  | 'largemouth-bass'
  | 'rainbow-trout';
export type LaunchId =
  | 'trinidad'
  | 'big-lagoon'
  | 'stone-lagoon'
  | 'mad-river-slough'
  | 'humboldt-bay-interior'
  | 'freshwater-lagoon';
export type VerdictLabel = 'GO' | 'CONDITIONAL' | 'NO-GO' | 'INCOMPLETE';
export type LayerStatus = 'pass' | 'warn' | 'fail' | 'incomplete';
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';
export type LayerName = 'legal' | 'safety' | 'quality' | 'logistics';
export type WindowState = 'past' | 'active' | 'upcoming';

export interface LayerResult {
  status: LayerStatus;
  summary: string;
}

export interface Check {
  layer: LayerName;
  name: string;
  value: string;
  threshold: string;
  status: CheckStatus;
  note?: string;
}

export interface TidePhaseAnnotation {
  /** Dominant tide phase across the window. 'mixed' when the window straddles a slack. */
  phase: 'ebb' | 'flood' | 'slack' | 'mixed';
  /** Maximum |velocity_major| observed within the (pre-clamp) window, in knots. */
  peakSpeedKt: number;
  /** Type of the peak event ('ebb' or 'flood'). 'slack' when no peak event falls inside the window. */
  peakType: 'ebb' | 'flood' | 'slack';
  /** Time of peak speed, formatted as "HH:MM PT". */
  peakTimeLocal: string;
  /** Short human-readable summary for the UI chip. */
  description: string;
}

/**
 * Everything the client-side now-evaluator needs, attached to TODAY's verdict
 * only. Times are epoch ms except tidalCurrents, which is passed through
 * verbatim so evaluateNow can reuse the PT-local-ISO tide machinery
 * (clampReturnByForEbb / annotateWindowWithTide) unchanged.
 */
export interface NowData {
  date: string;    // PT date this payload was computed for (rollover guard)
  dawnMs: number;  // civil dawn
  duskMs: number;  // civil dusk
  buoy?: NdbcObservation & { observedAtMs: number };  // open-ocean launches only
  tidalCurrents?: TidalCurrents;                       // launches with a currentStation only
  pointPeriods?: { startMs: number; endMs: number; windSpeed: string; windDirection: string }[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  phone?: string; // rendered as a tel: link when present
}

export interface NowVerdict {
  verdict: 'GO' | 'CONDITIONAL' | 'NO-GO';
  reason: string;
  nextViableAtMs?: number; // set only when the blocker is temporal AND conditions don't fail at that time
  launchByMs?: number;     // end of the CURRENT temporal-viability stretch (daylight/tide).
                           // Temporal gates only — conditions are a snapshot; re-verify at launch.
  returnByMs?: number;     // min(now + 4h cap, civil dusk), possibly ebb-clamped
  factors: Check[];        // recomputed condition checks (layer: 'safety')
  checklist: ChecklistItem[];
  staleness: { obsAgeMs: number | null; degraded: boolean };
  tideContext?: string;    // e.g. "flood building, peaks 1.2 kt at 16:48"
  footer?: string;         // canonical closing line, set on GO/CONDITIONAL
}

export interface LaunchWindow {
  label: string;        // "Morning", "Evening", "Around 13:11 slack", etc.
  launchAt: string;     // formatted local time, e.g. "05:51 PT"
  returnBy: string;     // formatted local time, e.g. "09:51 PT"
  checkInBy: string;    // returnBy + 1 hour — when shore contact should call USCG if no contact
  rationale?: string;   // short note explaining why this window
  tide?: TidePhaseAnnotation;  // populated on tide-aware launches when currents data is available
  warning?: string;            // populated when window is demoted (e.g. peak ebb in pre-clamp window > 1.5 kt)
  suppressed?: boolean;        // true when the window can't be safely launched but is kept visible (greyed) so the reason isn't hidden
  suppressedReason?: string;   // why it was suppressed (pre-dawn launch, ebb clamps trip under 2h, hostile ebb at launch)
  // Epoch-ms twins of the display strings above — added so the client can
  // derive past/active/upcoming state without re-parsing "HH:MM PT".
  // Truncated to the minute to match the labels exactly (SunCalc emits
  // seconds; the labels drop them) — don't "fix" by using raw Date.getTime().
  launchAtMs?: number;
  returnByMs?: number;
  checkInByMs?: number;
}

export interface Recommendations {
  windows?: LaunchWindow[];   // structured list of recommended launch windows
  window?: string;            // legacy single-window string; kept for backward compat
  gear?: string[];
  bailout?: string;
}

export type SourcePresence = 'live' | 'missing' | 'not-applicable';

export interface DataSources {
  buoy: SourcePresence;        // NDBC 46244 — applicable only to "today" verdicts
  nwsZone: SourcePresence;     // NWS CWF text product for PZZ450
  nwsPoint: SourcePresence;    // NWS point forecast for the launch's coordinates
  currents: SourcePresence;    // NOAA tidal currents — applies only to launches with currentStation
}

export interface Verdict {
  date: string;
  verdict: VerdictLabel;
  reason: string;
  layers: Record<LayerName, LayerResult>;
  checks: Check[];
  recommendations: Recommendations;
  dataSources: DataSources;
  nowData?: NowData; // present only on today's verdict — input for evaluateNow
}

export interface SourceFreshness {
  ndbc46244?: string;
  ndbc46022?: string;
  nwsZone?: string;
  nwsPoint?: string;
  tides?: string;
  tidalCurrents?: string;
  suntimes?: string;
}

export interface VerdictResponse {
  generatedAt: string;
  freshness: SourceFreshness;
  days: Verdict[];
}

export interface FetchedData {
  ndbc46244: NdbcObservation | null;
  ndbc46022: NdbcObservation | null;
  nwsZone: NwsZoneForecast | null;
  nwsPoint: NwsPointForecast | null;
  tides: TidePredictions | null;
  tidalCurrents: TidalCurrents | null;
  suntimes: SunTimes;
}

export interface NdbcObservation {
  observedAt: string;
  windKt: number | null;
  gustKt: number | null;
  windDirDeg: number | null;
  waveHtFt: number | null;
  dominantPeriodSec: number | null;
  meanWaveDirDeg: number | null;
  waterTempF: number | null;
}

export interface NwsZonePeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  detailedForecast: string;
}

export interface NwsZoneForecast {
  zone: string;
  updated: string;
  periods: NwsZonePeriod[];
}

export interface NwsPointPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
}

export interface NwsPointForecast {
  updated: string;
  periods: NwsPointPeriod[];
}

export interface TideEvent {
  time: string;
  height: number;
  type: 'H' | 'L';
}

export interface TidePredictions {
  station: string;
  events: TideEvent[];
}

export type TidalCurrentEventType = 'slack' | 'flood' | 'ebb';

export interface TidalCurrentEvent {
  time: string;             // Local LST/LDT, format "YYYY-MM-DDTHH:MM"
  type: TidalCurrentEventType;
  velocityKt: number;       // Signed: positive = flood, negative = ebb, ~0 = slack
  meanFloodDirDeg: number;
  meanEbbDirDeg: number;
}

export interface TidalCurrents {
  station: string;
  units: string;
  events: TidalCurrentEvent[];
}

export interface SunTimes {
  byDate: Record<string, {
    civilDawn: string;
    sunrise: string;
    sunset: string;
    civilDusk: string;
  }>;
}

const LAYER_STATUSES: LayerStatus[] = ['pass', 'warn', 'fail', 'incomplete'];
const VERDICT_LABELS: VerdictLabel[] = ['GO', 'CONDITIONAL', 'NO-GO', 'INCOMPLETE'];

export function isLayerStatus(x: unknown): x is LayerStatus {
  return typeof x === 'string' && (LAYER_STATUSES as string[]).includes(x);
}

export function isVerdictLabel(x: unknown): x is VerdictLabel {
  return typeof x === 'string' && (VERDICT_LABELS as string[]).includes(x);
}
