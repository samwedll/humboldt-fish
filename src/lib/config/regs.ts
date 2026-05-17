/**
 * Mirror of reference/regs/*.md (rockfish-lingcod, salmon-kmz, surfperch, cutthroat,
 * california-halibut, dungeness-crab, pacific-halibut, albacore-tuna).
 * Source of truth is the markdown; this is the runtime copy.
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
 * - Dungeness crab: CDPH domoic-acid advisory is surfaced as a requirements line, not
 *   as a hotline — it's an always-check, not a one-shot call.
 */
import type { Species } from '../types.js';

export interface SpeciesRegs {
  label: string;
  seasonWindows: Array<{ start: string; end: string }>;
  requirements: string[];
  hotlinePhone?: string;
  hotlineLabel?: string;
  requiresHotlineVerify: boolean;
}

export const regs: Record<Species, SpeciesRegs> = {
  rockfish: {
    label: 'Rockfish (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License',
      'descender device on board (CCR T-14, §27.20(b)(2))',
      'RCG aggregate bag 10/day; vermilion+sunset sub-limit 4 in Northern Mgmt Area',
      'No retention: bronzespotted, cowcod, quillback, yelloweye rockfish'
    ],
    requiresHotlineVerify: false
  },
  lingcod: {
    label: 'Lingcod (Northern Mgmt Area)',
    seasonWindows: [{ start: '2026-04-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License',
      'descender device on board (combined groundfish trips)',
      '22" minimum size, 2 fish daily bag',
      'Fillets: min 14" with entire skin attached'
    ],
    requiresHotlineVerify: false
  },
  salmon: {
    label: 'Salmon (KMZ — Klamath Management Zone)',
    seasonWindows: [
      { start: '2026-06-13', end: '2026-07-19' },
      { start: '2026-08-01', end: '2026-08-31' }
    ],
    requirements: [
      'CDFW Sport Fishing License (no salmon report card required for ocean salmon)',
      '20" minimum size (Chinook); coho prohibited — must release',
      'Max 2 single-point, single-shank, barbless hooks',
      'One rod per angler when targeting salmon or with salmon aboard'
    ],
    hotlinePhone: '707-576-3429',
    hotlineLabel: 'CDFW Ocean Salmon Hotline',
    requiresHotlineVerify: true
  },
  surfperch: {
    label: 'Surfperch (Northern District)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License (16+)',
      'Daily bag: 20 fish total in the surfperch family',
      'Redtail surfperch sub-limit applies (verify current with CDFW)'
    ],
    requiresHotlineVerify: false
  },
  cutthroat: {
    label: 'Coastal Cutthroat Trout (Humboldt Lagoons)',
    // Big Lagoon historically year-round; Stone Lagoon closed Nov 21 – end of Feb.
    // Model conservatively: open Mar 1 – Nov 20 (the Stone Lagoon-safe window).
    // Big Lagoon-only trips outside this window are still legal but require manual verify.
    seasonWindows: [{ start: '2026-03-01', end: '2026-11-20' }],
    requirements: [
      'CDFW Sport Fishing License (16+)',
      'Daily bag: 1 fish (both lagoons historically)',
      'Artificial-lure-only, single-point barbless hook (historically) — verify 2026',
      'Catch-and-release encouraged; species of conservation concern'
    ],
    requiresHotlineVerify: false
  },
  'california-halibut': {
    label: 'California Halibut (Northern District)',
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License (16+)',
      'Daily bag: 3 fish',
      'Minimum size: 22 inches total length'
    ],
    requiresHotlineVerify: false
  },
  'dungeness-crab': {
    label: 'Dungeness Crab (Sport)',
    // Sport season: Nov 1 – Jul 30 (historical). Off-season Aug 1 – Oct 31.
    // Domoic-acid closures can drop inseason; CDPH advisory check is in requirements.
    seasonWindows: [
      { start: '2026-01-01', end: '2026-07-30' },
      { start: '2026-11-01', end: '2026-12-31' }
    ],
    requirements: [
      'CDFW Sport Fishing License (16+)',
      'Daily bag: 10 crabs',
      'Minimum size: 5.75" across the back',
      'Check CDPH for domoic-acid closures before every trip'
    ],
    requiresHotlineVerify: false
  },
  'pacific-halibut': {
    label: 'Pacific Halibut',
    // Typical IPHC window May 1 – Nov 15; can close inseason without warning.
    seasonWindows: [{ start: '2026-05-01', end: '2026-11-15' }],
    requirements: [
      'CDFW Sport Fishing License (16+)',
      'Pacific Halibut Card (free, online from CDFW) — must record each kept fish',
      'Daily bag: 1 fish',
      'Minimum size: 22 inches total length',
      'Season can close inseason without warning — verify before each trip'
    ],
    hotlinePhone: undefined,
    hotlineLabel: 'CDFW Pacific Halibut page + IPHC inseason actions',
    requiresHotlineVerify: true
  },
  'albacore-tuna': {
    label: 'Albacore Tuna',
    // Legal year-round; real-world viable window is June–October when 60°F+ water pushes inshore.
    seasonWindows: [{ start: '2026-01-01', end: '2026-12-31' }],
    requirements: [
      'CDFW Sport Fishing License (16+)',
      'No bag limit on albacore (verify current)',
      'No size limit',
      'Real-world viability is June–October when 60°F+ water pushes inshore'
    ],
    requiresHotlineVerify: false
  }
};

export interface SeasonCheck {
  open: boolean;
  reason?: string;
}

export function isSpeciesOpen(species: Species, dateISO: string): SeasonCheck {
  const r = regs[species];
  const inWindow = r.seasonWindows.some(
    (w) => dateISO >= w.start && dateISO <= w.end
  );
  if (inWindow) return { open: true };
  return {
    open: false,
    reason: `${r.label} closed on ${dateISO}. Open windows: ${r.seasonWindows
      .map((w) => `${w.start} – ${w.end}`)
      .join(', ')}.`
  };
}
