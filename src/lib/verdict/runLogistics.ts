import type {
  FetchedData,
  LayerResult,
  Check,
  Species,
  LaunchId,
  Recommendations
} from '../types.js';
import { getLaunch } from '../config/launches.js';

export interface LogisticsInput {
  species: Species;
  date: string;
  launch: LaunchId;
  data: FetchedData;
}
export interface LogisticsOutput {
  result: LayerResult;
  checks: Check[];
  recommendations: Recommendations;
}

const BASE_GEAR = [
  'PFD (worn at all times)',
  'semi-dry paddling top + dry pants + 3mm long john',
  'Neoprene gloves + booties + beanie',
  'VHF on, Channel 16 monitored; bar reports on Ch 22A, Trinidad local Ch 78',
  'Phone in waterproof case, accessible',
  'Float plan filed with shore contact'
];

const SPECIES_GEAR: Record<Species, string[]> = {
  rockfish: [
    'Descender device rigged and accessible',
    'Jigging rods + leadhead/swimbait selection'
  ],
  lingcod: ['Descender device rigged and accessible', 'Swimbait or live-bait setup'],
  salmon: [
    'Max 2 single-point, single-shank, barbless hooks',
    'CDFW Salmon hotline checked within 2 h of launch'
  ],
  surfperch: [
    'Surf rod 7-9 ft with pyramid sinker',
    'Pile worm / sand crab / ghost shrimp bait',
    'Small hooks (size 4-6 baitholder)'
  ],
  cutthroat: [
    'Single-point barbless lure (per lagoon regs)',
    'Light spinning gear, 4-6 lb leader',
    'Catch-and-release tools (forceps, wet hands)'
  ],
  'california-halibut': [
    'Halibut spreader rig with 8-12 oz weight',
    'Live bait (anchovy/smelt) or plastic swimbait',
    'Landing net (halibut shake hooks at the surface)'
  ],
  'dungeness-crab': [
    'Hoop net (max 10 per person)',
    'Bait box with chicken or fish racks',
    '100+ ft line with surface buoy',
    'Crab gauge (5.75" across the back minimum)',
    'Check CDPH domoic-acid advisory within 2h of launch'
  ],
  'pacific-halibut': [
    'Pacific Halibut Card on board (record each kept fish)',
    'Heavy jigging rod with 24-32 oz lead-head jig',
    'Large gaff or BogaGrip',
    'Marine VHF + EPIRB recommended (long offshore trip)',
    'Float plan filed with shore contact'
  ],
  'albacore-tuna': [
    'Trolling rod with cedar plug or chrome jet',
    'Ice on board — bleed and chill fish immediately',
    'GPS track + Marine VHF + EPIRB',
    'Verify water temp ≥ 60°F within paddle range before committing'
  ]
};

const SPECIES_RISK: Partial<Record<Species, string>> = {
  'pacific-halibut':
    'Deep-water trip (3-5 mi offshore at Trinidad). Long forecast horizon needed — wind/swell must hold for 6-8 hours. Not solo year 1.',
  'albacore-tuna':
    'Far-offshore pelagic. Most years albacore are out of kayak range. Only attempt with 60°F+ water within paddle range, deeply calm forecast, accompanied trip.'
};

export function runLogistics({
  species,
  date,
  launch,
  data
}: LogisticsInput): LogisticsOutput {
  const launchProfile = getLaunch(launch);
  const sun = data.suntimes.byDate[date];

  const checks: Check[] = [
    {
      layer: 'logistics',
      name: 'Launch',
      value: launchProfile.label,
      threshold: 'open-Pacific launches: Trinidad only',
      status: 'pass'
    }
  ];

  if (launchProfile.openOcean) {
    checks.push({
      layer: 'logistics',
      name: 'Solo restriction',
      value: 'assumes accompanied trip',
      threshold: 'Trinidad outside breakwater: not solo (year 1)',
      status: 'pass',
      note: 'Solo trips outside Trinidad breakwater are NO-GO until ocean experience grows. This verdict assumes an accompanied trip (companion on the water). If launching solo, treat as NO-GO regardless of other indicators.'
    });
  } else {
    checks.push({
      layer: 'logistics',
      name: 'Solo',
      value: 'permitted',
      threshold: 'protected water — solo OK',
      status: 'pass'
    });
  }

  if (launchProfile.requiresTideAwareness) {
    checks.push({
      layer: 'logistics',
      name: 'Tide planning',
      value: 'plan return on flood',
      threshold: 'avoid getting caught on outgoing tide / at low water',
      status: 'pass',
      note: launchProfile.notes
    });
  }

  const risk = SPECIES_RISK[species];
  if (risk) {
    checks.push({
      layer: 'logistics',
      name: 'Trip risk',
      value: 'situational',
      threshold: 'committed-paddler trip',
      status: 'pass',
      note: risk
    });
  }

  if (species === 'pacific-halibut') {
    checks.push({
      layer: 'logistics',
      name: 'Pacific halibut quota',
      value: 'verify within 24h',
      threshold: 'season can close inseason without warning',
      status: 'pass',
      note: 'Check CDFW Pacific Halibut page + IPHC inseason actions before launch.'
    });
  }

  let window: string | undefined;
  if (sun) {
    const dawn = new Date(sun.civilDawn);
    const launchTime = new Date(dawn.getTime() + 30 * 60 * 1000);
    const returnBy = new Date(launchTime.getTime() + 4 * 60 * 60 * 1000);
    window = `Launch ${launchTime.toISOString().slice(11, 16)}Z, return by ${returnBy.toISOString().slice(11, 16)}Z (4h cap)`;
  }

  return {
    result: { status: 'pass', summary: `${launchProfile.label}, ${species}` },
    checks,
    recommendations: { window, gear: [...BASE_GEAR, ...SPECIES_GEAR[species]] }
  };
}
