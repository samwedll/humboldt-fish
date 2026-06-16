/**
 * Mirror of reference/regs/*.md (rockfish-lingcod, salmon-kmz, surfperch, cutthroat,
 * california-halibut, dungeness-crab, pacific-halibut, albacore-tuna).
 * Source of truth is the markdown; this is the runtime copy.
 * Each species' rules + meta mirror reference/regs/<file>.md (size/bag/gear/license/other +
 * the header's Last-updated/DRAFT/Source).
 * When a reg file changes, update this file in the same commit.
 *
 * Notes vs. reference markdown:
 * - Salmon: reference explicitly states "No salmon report card required for ocean salmon"
 *   (the river fisheries are separate). Requirement strings reflect that.
 * - Salmon hooks: reference specifies "Max 2 single-point, single-shank, barbless hooks".
 *   Circle hooks are NOT mandatory in ocean salmon — only defined where used.
 * - Groundfish license: reference cites "California sport fishing license" without naming
 *   the Ocean Enhancement Stamp, so we do not assert it here.
 * - Pacific halibut: requiresHotlineVerify=true is a "verify status before launch" flag,
 *   not a phone-hotline call. hotlinePhone is intentionally undefined.
 * - Dungeness crab: CDPH domoic-acid advisory is surfaced as an `otherRules` entry, not
 *   as a hotline — it's an always-check, not a one-shot call.
 */
import type { Species, LaunchId } from '../types.js';

export type Confidence = 'confirmed' | 'historical' | 'unverified';

/** A regulatory value that may be confirmed-for-2026 or merely last-known. */
export interface RegValue<T> {
  value: T;
  confidence: Confidence;
  note?: string;
}

export interface SizeLimit { minInches?: number; measure?: string; none?: boolean; }
export interface BagLimit { daily?: number; possession?: number; unit?: string; none?: boolean; }
export interface SubLimit { species: string; daily: number; note?: string; }

export interface CatchRules {
  size: RegValue<SizeLimit>;
  bag: RegValue<BagLimit>;
  subLimits?: RegValue<SubLimit[]>;
  prohibited?: string[];          // zero-retention species / release-only rules
  gear?: RegValue<string[]>;
  license: string[];
  otherRules?: string[];          // catch-all w/o a typed home
}

/** Verification metadata, lifted from the species' reference/regs/*.md header. */
export interface RegMeta { lastUpdated: string; draft: boolean; sourceUrl: string; }

export interface SpeciesRegs {
  label: string;
  seasonWindows: Array<{ start: string; end: string }>;
  /**
   * Per-launch overrides for cases where a species has different season
   * windows at different waters (e.g., cutthroat is year-round at Big Lagoon
   * but has a Nov 21–Feb spawning closure at Stone Lagoon).
   * If unset for a launch, falls back to the default `seasonWindows`.
   */
  perLaunchSeasonWindows?: Partial<Record<LaunchId, Array<{ start: string; end: string }>>>;
  rules: CatchRules;
  meta: RegMeta;
  hotlinePhone?: string;
  hotlineLabel?: string;
  requiresHotlineVerify: boolean;
}

export const regs: Record<Species, SpeciesRegs> = {
  rockfish: {
    label: 'Rockfish (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { daily: 10, unit: 'fish' }, confidence: 'confirmed',
             note: 'RCG aggregate (rockfish/cabezon/greenling complex)' },
      subLimits: { value: [{ species: 'vermilion + sunset rockfish', daily: 4, note: 'Northern Mgmt Area' }],
                   confidence: 'confirmed' },
      prohibited: ['bronzespotted rockfish', 'cowcod', 'quillback rockfish', 'yelloweye rockfish'],
      license: ['CDFW Sport Fishing License'],
      otherRules: ['Descender device required on board (CCR T-14 §27.20(b)(2))']
    },
    meta: { lastUpdated: 'May 2, 2026', draft: false,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Groundfish-Summary' },
    requiresHotlineVerify: false
  },
  lingcod: {
    label: 'Lingcod (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    rules: {
      size: { value: { minInches: 22, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 2, unit: 'fish' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License'],
      otherRules: [
        'Descender device required on board (combined groundfish trips)',
        'Fillets: minimum 14" with entire skin attached'
      ]
    },
    meta: { lastUpdated: 'May 2, 2026', draft: false,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Groundfish-Summary' },
    requiresHotlineVerify: false
  },
  salmon: {
    label: 'Salmon (KMZ — Klamath Management Zone)',
    seasonWindows: [
      { start: '2026-06-13', end: '2026-07-19' },
      { start: '2026-08-01', end: '2026-08-31' }
    ],
    rules: {
      size: { value: { minInches: 20, measure: 'total length' }, confidence: 'confirmed', note: 'Chinook' },
      bag: { value: { daily: 2, unit: 'Chinook' }, confidence: 'confirmed' },
      prohibited: ['Coho (silver) salmon — prohibited, must release'],
      gear: { value: [
        'Max 2 single-point, single-shank, barbless hooks',
        'One rod per angler when targeting salmon or with salmon aboard'
      ], confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (no salmon report card required for ocean salmon)']
    },
    meta: { lastUpdated: 'May 2, 2026', draft: false,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Salmon' },
    hotlinePhone: '707-576-3429',
    hotlineLabel: 'CDFW Ocean Salmon Hotline',
    requiresHotlineVerify: true
  },
  surfperch: {
    label: 'Surfperch (Northern District)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { daily: 20, unit: 'fish' }, confidence: 'confirmed', note: 'total across the surfperch family' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Redtail surfperch sub-limit applies — verify current with CDFW']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Surf-Fishing' },
    requiresHotlineVerify: false
  },
  cutthroat: {
    label: 'Coastal Cutthroat Trout (Humboldt Lagoons)',
    // Stone Lagoon has a Nov 21 – end of Feb spawning closure (CDFW manages spit
    // openings around fish-passage windows). Big Lagoon is year-round.
    // Default reflects Stone's window; Big Lagoon overrides to year-round.
    seasonWindows: [{ start: '2026-03-01', end: '2026-11-20' }],
    perLaunchSeasonWindows: {
      'big-lagoon': [{ start: '2026-01-01', end: '2026-12-31' }]
    },
    rules: {
      size: { value: { minInches: 14, measure: 'total length' }, confidence: 'historical',
              note: 'Big Lagoon historically — verify 2026 with CDFW' },
      bag: { value: { daily: 1, possession: 1, unit: 'fish' }, confidence: 'historical',
             note: 'both lagoons historically' },
      gear: { value: ['Artificial-lure only', 'Single-point barbless hook (no bait, no treble)'],
              confidence: 'historical', note: 'historically — verify 2026' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Catch-and-release encouraged; coastal cutthroat is a species of conservation concern']
    },
    meta: { lastUpdated: '2026-05-17', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' },
    requiresHotlineVerify: false
  },
  'california-halibut': {
    label: 'California Halibut (Northern District)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { minInches: 22, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 3, unit: 'fish' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (16+)']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Saltwater-General' },
    requiresHotlineVerify: false
  },
  'dungeness-crab': {
    label: 'Dungeness Crab (Sport)',
    // Sport season: Nov 1 – Jul 30 (historical). Off-season Aug 1 – Oct 31.
    // Domoic-acid closures can drop inseason; CDPH advisory check is in otherRules.
    seasonWindows: [
      { start: '2026-01-01', end: '2026-07-30' },
      { start: '2026-11-01', end: '2026-12-31' }
    ],
    rules: {
      size: { value: { minInches: 5.75, measure: 'carapace width across the back' }, confidence: 'confirmed' },
      bag: { value: { daily: 10, unit: 'crabs' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Check CDPH for domoic-acid closures before every trip']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Crab' },
    requiresHotlineVerify: false
  },
  'pacific-halibut': {
    label: 'Pacific Halibut',
    // Typical IPHC window May 1 – Nov 15; can close inseason without warning.
    seasonWindows: [{ start: '2026-05-01', end: '2026-11-15' }],
    rules: {
      size: { value: { minInches: 22, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 1, unit: 'fish' }, confidence: 'confirmed' },
      license: ['CDFW Sport Fishing License (16+)',
                'Pacific Halibut Card (free, online from CDFW) — must record each kept fish'],
      otherRules: ['Season can close inseason without warning — verify before each trip']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Pacific-Halibut' },
    hotlinePhone: undefined,
    hotlineLabel: 'CDFW Pacific Halibut page + IPHC inseason actions',
    requiresHotlineVerify: true
  },
  'albacore-tuna': {
    label: 'Albacore Tuna',
    // Legal year-round; real-world viable window is June–October when 60°F+ water pushes inshore.
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { none: true }, confidence: 'unverified', note: 'no bag limit — verify current' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Real-world viability is June–October when 60°F+ water pushes inshore']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Ocean/Regulations/Tuna' },
    requiresHotlineVerify: false
  },
  bluegill: {
    label: 'Bluegill (CA Inland)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed' },
      bag: { value: { none: true }, confidence: 'confirmed', note: 'no bag limit in most CA inland waters' },
      license: ['CDFW Sport Fishing License (16+)']
    },
    meta: { lastUpdated: '2026-05-17', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' },
    requiresHotlineVerify: false
  },
  'largemouth-bass': {
    label: 'Largemouth Bass',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { minInches: 12, measure: 'total length' }, confidence: 'confirmed' },
      bag: { value: { daily: 5, unit: 'fish' }, confidence: 'confirmed',
             note: 'largemouth/smallmouth/spotted combined (black bass)' },
      license: ['CDFW Sport Fishing License (16+)']
    },
    meta: { lastUpdated: '2026-05-17', draft: true,
            sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland/Black-Bass' },
    requiresHotlineVerify: false
  },
  'rainbow-trout': {
    label: 'Rainbow Trout (stocker / inland)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    rules: {
      size: { value: { none: true }, confidence: 'confirmed', note: 'no statewide inland size limit' },
      bag: { value: { daily: 5, unit: 'trout' }, confidence: 'confirmed', note: 'statewide inland' },
      license: ['CDFW Sport Fishing License (16+)'],
      otherRules: ['Check CDFW fish-planting schedule before each trip — fishing is best 1-2 days after a plant']
    },
    meta: { lastUpdated: '2026-05-17', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' },
    requiresHotlineVerify: false
  }
};

export interface SeasonCheck {
  open: boolean;
  reason?: string;
}

/**
 * Check whether a species is in season on a date. Optionally launch-aware —
 * if `launch` is provided AND `regs[species].perLaunchSeasonWindows[launch]`
 * is defined, those windows override the default. This is how cutthroat is
 * year-round at Big Lagoon but Nov 21–Feb closed at Stone Lagoon.
 */
export function isSpeciesOpen(
  species: Species,
  dateISO: string,
  launch?: LaunchId
): SeasonCheck {
  const r = regs[species];
  const windows = (launch && r.perLaunchSeasonWindows?.[launch]) ?? r.seasonWindows;
  const inWindow = windows.some((w) => dateISO >= w.start && dateISO <= w.end);
  if (inWindow) return { open: true };
  return {
    open: false,
    reason: `${r.label} closed on ${dateISO}. Open windows: ${windows
      .map((w) => `${w.start} – ${w.end}`)
      .join(', ')}.`
  };
}
