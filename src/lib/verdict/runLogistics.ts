import type {
  FetchedData,
  LayerResult,
  Check,
  Species,
  LaunchId,
  Recommendations,
  TidalCurrents,
  TidalCurrentEvent
} from '../types.js';
import { getLaunch } from '../config/launches.js';
import { formatPacificTime } from '../format.js';

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
  ],
  bluegill: [
    'Light spinning rod (4-6 lb test)',
    'Small hooks size 8-12 + worms / mealworms / wax worms',
    'Bobber rig or small jig (1/64-1/32 oz)'
  ],
  'largemouth-bass': [
    'Medium-heavy spinning or baitcasting rod (10-15 lb test)',
    'Soft plastic worms (Texas / drop-shot / weightless), spinnerbaits, crankbaits',
    'Catch-and-release encouraged for larger fish'
  ],
  'rainbow-trout': [
    'Light spinning rod (4-6 lb test)',
    'PowerBait / salmon eggs / small spinners (Mepps, Roostertails)',
    'Barbless hooks recommended for catch-and-release',
    'Check CDFW fish-planting schedule — bite best 1-2 days after a plant'
  ]
};

/**
 * Pull the events that fall on the given local date (YYYY-MM-DD). Times in the
 * payload are NOAA-local (LST/LDT), so a plain string-prefix match is correct.
 */
function eventsOnDate(currents: TidalCurrents, date: string): TidalCurrentEvent[] {
  return currents.events.filter((e) => e.time.startsWith(date));
}

/** "YYYY-MM-DDTHH:MM" → fractional hour (e.g. "07:28" → 7.466). */
function hourOf(timeStr: string): number {
  const t = timeStr.slice(11, 16);
  const [hh, mm] = t.split(':').map(Number);
  return hh + mm / 60;
}

function fmtTime(timeStr: string): string {
  // Currents API is requested with time_zone=lst_ldt → already Pacific local.
  return `${timeStr.slice(11, 16)} PT`;
}

interface CurrentsSummary {
  morningSlack?: TidalCurrentEvent;
  floodPeak?: TidalCurrentEvent;
  ebbPeak?: TidalCurrentEvent;
}

/**
 * Find:
 *  - the morning slack (a "slack" event between 04:00 and 11:00 local on `date`)
 *  - the next flood peak after that slack (max positive Velocity_Major in the flood block)
 *  - the next ebb peak after the following slack (max-magnitude negative velocity in the ebb block)
 *
 * If no morning slack exists, leave all three undefined — the caller will fall back to
 * an "unknown" status.
 */
export function summarizeCurrents(currents: TidalCurrents, date: string): CurrentsSummary {
  const sameDay = eventsOnDate(currents, date);
  const morningSlack = sameDay.find(
    (e) => e.type === 'slack' && hourOf(e.time) >= 4 && hourOf(e.time) <= 11
  );
  if (!morningSlack) return {};

  // Walk forward through the full event list (which may include events on
  // following days) starting at the morning-slack index to pick the next
  // flood-peak event, then the next ebb-peak event after the slack that
  // separates them.
  const idx = currents.events.indexOf(morningSlack);
  const tail = currents.events.slice(idx + 1);

  let floodPeak: TidalCurrentEvent | undefined;
  let ebbPeak: TidalCurrentEvent | undefined;
  for (const e of tail) {
    if (!floodPeak && e.type === 'flood') {
      floodPeak = e;
      continue;
    }
    if (floodPeak && !ebbPeak && e.type === 'ebb') {
      ebbPeak = e;
      break;
    }
  }

  return { morningSlack, floodPeak, ebbPeak };
}

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

    // Tidal-currents check: only run when the launch profile has a current
    // station mapped to it. The data may still be missing — in that case we
    // surface an "unknown" check (informational, not blocking).
    if (launchProfile.currentStation) {
      if (data.tidalCurrents) {
        const { morningSlack, floodPeak, ebbPeak } = summarizeCurrents(
          data.tidalCurrents,
          date
        );
        if (morningSlack) {
          const parts: string[] = [`Morning slack ${fmtTime(morningSlack.time)}`];
          if (floodPeak) {
            parts.push(
              `flood peaks ${fmtTime(floodPeak.time)} at ${Math.abs(floodPeak.velocityKt).toFixed(1)} kt`
            );
          }
          if (ebbPeak) {
            parts.push(
              `ebb peaks ${fmtTime(ebbPeak.time)} at ${Math.abs(ebbPeak.velocityKt).toFixed(1)} kt`
            );
          }
          checks.push({
            layer: 'logistics',
            name: 'Tidal currents',
            value: parts.join('; '),
            threshold: '—',
            status: 'pass',
            note: 'Launch on the last 90 min of flood or at slack. Return before the ebb builds past 1.5 kt.'
          });
        } else {
          checks.push({
            layer: 'logistics',
            name: 'Tidal currents',
            value: 'no morning slack on this date',
            threshold: '—',
            status: 'unknown',
            note: 'NOAA returned data but no slack between 04:00–11:00 local.'
          });
        }
      } else {
        checks.push({
          layer: 'logistics',
          name: 'Tidal currents',
          value: 'data unavailable',
          threshold: '—',
          status: 'unknown',
          note: 'NOAA tidal-currents fetch failed; using tide-cycle planning only.'
        });
      }
    }
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
    window = `Launch ${formatPacificTime(launchTime)}, return by ${formatPacificTime(returnBy)} (4-hour trip cap)`;
  }

  return {
    result: { status: 'pass', summary: `${launchProfile.label}, ${species}` },
    checks,
    recommendations: { window, gear: [...BASE_GEAR, ...SPECIES_GEAR[species]] }
  };
}
