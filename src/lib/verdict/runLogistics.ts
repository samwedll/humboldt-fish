import type {
  FetchedData,
  LayerResult,
  Check,
  Species,
  LaunchId,
  LaunchWindow,
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

/**
 * Shift a Pacific-local time string ("YYYY-MM-DDTHH:MM") by N minutes,
 * returning "HH:MM PT". Does NOT go through Date(), because parsing a
 * timezone-less string with new Date() interprets it as the host's local
 * time (UTC on Cloudflare Workers), which produces wrong PT output.
 */
function shiftPacificTime(localTime: string, deltaMinutes: number): string {
  const hm = localTime.split('T')[1] ?? localTime;
  const [hh, mm] = hm.split(':').map(Number);
  const totalMin = hh * 60 + mm + deltaMinutes;
  const wrapped = ((totalMin % 1440) + 1440) % 1440;
  const newHh = Math.floor(wrapped / 60);
  const newMm = wrapped % 60;
  return `${String(newHh).padStart(2, '0')}:${String(newMm).padStart(2, '0')} PT`;
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

const EBB_WARN_KT = 1.5;
const FLOOD_WARN_KT = 3.0;
const CLAMP_BUFFER_MIN = 15;
const MIN_TRIP_HOURS = 2;

/**
 * "HH:MM PT" formatted from a "YYYY-MM-DDTHH:MM" Pacific-local string.
 * Lives next to other helpers in this file so we don't ferry Date objects around.
 */
function ptIsoToHhmmLabel(iso: string): string {
  return `${iso.slice(11, 16)} PT`;
}

/**
 * Annotate a launch window with its dominant tide phase, peak current, and a
 * short prose summary suitable for a UI chip.
 *
 * windowStart / windowEnd are Pacific-local "YYYY-MM-DDTHH:MM" strings — the
 * same form as TidalCurrentEvent.time. String comparison is correct under that
 * format.
 */
export function annotateWindowWithTide(
  windowStart: string,
  windowEnd: string,
  currents: TidalCurrents
): import('../types.js').TidePhaseAnnotation {
  const events = currents.events;
  const inside = events.filter((e) => e.time >= windowStart && e.time <= windowEnd);

  // Determine phase. If a slack falls inside the window, the window crosses
  // a transition: phase = 'mixed'. Otherwise, find the bracketing flood/ebb
  // event by walking forward through events from windowStart.
  const slackInside = inside.find((e) => e.type === 'slack');
  let phase: 'ebb' | 'flood' | 'slack' | 'mixed';
  if (slackInside) {
    phase = 'mixed';
  } else {
    const next = events.find((e) => e.time >= windowStart);
    if (next && next.type !== 'slack') {
      phase = next.type;
    } else {
      const bracketing = [
        ...inside,
        ...events.filter((e) => e.time < windowStart).slice(-1),
        ...events.filter((e) => e.time > windowEnd).slice(0, 1)
      ];
      const strongest = bracketing.reduce((acc, e) =>
        Math.abs(e.velocityKt) > Math.abs(acc.velocityKt) ? e : acc,
        bracketing[0]
      );
      phase = strongest.type === 'slack' ? 'slack' : strongest.type;
    }
  }

  // Peak speed: max |velocity_major| among events inside the window. If none
  // are inside (very short window), fall back to the larger of the two
  // bracketing events.
  let peakEvent: TidalCurrentEvent | undefined = inside.reduce<TidalCurrentEvent | undefined>(
    (acc, e) => (!acc || Math.abs(e.velocityKt) > Math.abs(acc.velocityKt) ? e : acc),
    undefined
  );
  if (!peakEvent) {
    const before = events.filter((e) => e.time < windowStart).slice(-1)[0];
    const after = events.filter((e) => e.time > windowEnd)[0];
    peakEvent = [before, after]
      .filter((e): e is TidalCurrentEvent => e !== undefined)
      .reduce<TidalCurrentEvent | undefined>(
        (acc, e) => (!acc || Math.abs(e.velocityKt) > Math.abs(acc.velocityKt) ? e : acc),
        undefined
      );
  }
  const peakSpeedKt = peakEvent ? Math.abs(peakEvent.velocityKt) : 0;
  const peakType: 'ebb' | 'flood' | 'slack' = peakEvent ? peakEvent.type : 'slack';
  const peakTimeLocal = peakEvent ? ptIsoToHhmmLabel(peakEvent.time) : ptIsoToHhmmLabel(windowStart);

  // Description.
  let description: string;
  if (phase === 'mixed') {
    const slack = inside.find((e) => e.type === 'slack')!;
    const peak = inside.find((e) => e.type !== 'slack');
    if (peak) {
      const earlierPhase = peak.time < slack.time ? peak.type : (peak.type === 'flood' ? 'ebb' : 'flood');
      const laterPhase = earlierPhase === 'flood' ? 'ebb' : 'flood';
      description = `${earlierPhase} → slack ${slack.time.slice(11, 16)} → ${laterPhase} (peaks ${peakSpeedKt.toFixed(1)} kt at ${peak.time.slice(11, 16)})`;
    } else {
      description = `slack ${slack.time.slice(11, 16)} mid-window`;
    }
  } else if (phase === 'flood') {
    description = `flood building, peaks ${peakSpeedKt.toFixed(1)} kt at ${peakTimeLocal.replace(' PT', '')}`;
  } else if (phase === 'ebb') {
    description = `ebb (peaks ${peakSpeedKt.toFixed(1)} kt at ${peakTimeLocal.replace(' PT', '')})`;
  } else {
    description = `slack`;
  }

  return { phase, peakSpeedKt, peakType, peakTimeLocal, description };
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

  // ============================================================
  // Recommended launch windows
  // ============================================================
  // - All launches: morning twilight window (civil dawn + 30 min → 4h cap).
  // - Non-open-ocean launches: also an evening twilight window
  //   (4h before civil dusk → civil dusk).
  //   Trinidad is excluded because afternoon Pacific wind builds dangerously
  //   (per reference/launches.md: "Launch early — wind picks up by 11 AM consistently").
  // - Tide-aware launches with currents data: also an afternoon-slack window
  //   when a slack falls between 12:00 and 18:00 local Pacific.
  const windows: LaunchWindow[] = [];

  if (sun) {
    const dawn = new Date(sun.civilDawn);
    const morningLaunch = new Date(dawn.getTime() + 30 * 60 * 1000);
    const morningReturn = new Date(morningLaunch.getTime() + 4 * 60 * 60 * 1000);
    const morningCheckIn = new Date(morningReturn.getTime() + 60 * 60 * 1000);
    windows.push({
      label: 'Morning',
      launchAt: formatPacificTime(morningLaunch),
      returnBy: formatPacificTime(morningReturn),
      checkInBy: formatPacificTime(morningCheckIn),
      rationale:
        launchProfile.openOcean
          ? 'Pacific wind typically builds by 11 AM — morning is the safe window.'
          : '4-hour trip cap from 30 min after civil dawn.'
    });

    if (!launchProfile.openOcean) {
      const dusk = new Date(sun.civilDusk);
      const eveningLaunch = new Date(dusk.getTime() - 4 * 60 * 60 * 1000);
      const eveningCheckIn = new Date(dusk.getTime() + 60 * 60 * 1000);
      windows.push({
        label: 'Evening',
        launchAt: formatPacificTime(eveningLaunch),
        returnBy: formatPacificTime(dusk),
        checkInBy: formatPacificTime(eveningCheckIn),
        rationale: 'Late afternoon to civil dusk; common second bite, wind often drops at sunset.'
      });
    }
  }

  // Afternoon slack window for tide-aware launches when currents data is available.
  // Slack times are already in Pacific local; do not parse through Date().
  if (launchProfile.currentStation && data.tidalCurrents) {
    const slacks = data.tidalCurrents.events.filter(
      (e) => e.type === 'slack' && e.time.startsWith(date)
    );
    const afternoonSlack = slacks.find((e) => {
      const hr = Number(e.time.slice(11, 13));
      return hr >= 12 && hr < 18;
    });
    if (afternoonSlack) {
      windows.push({
        label: `Around ${fmtTime(afternoonSlack.time)} slack`,
        launchAt: shiftPacificTime(afternoonSlack.time, -30),
        returnBy: shiftPacificTime(afternoonSlack.time, -30 + 4 * 60),
        checkInBy: shiftPacificTime(afternoonSlack.time, -30 + 5 * 60),
        rationale: 'Tide-driven — launch ~30 min before slack, fish through the turn, return on the building tide.'
      });
    }
  }

  // Legacy single-window string for any consumer that hasn't migrated.
  const legacyWindow = windows[0]
    ? `Launch ${windows[0].launchAt}, return by ${windows[0].returnBy} (4-hour trip cap)`
    : undefined;

  return {
    result: { status: 'pass', summary: `${launchProfile.label}, ${species}` },
    checks,
    recommendations: {
      windows: windows.length > 0 ? windows : undefined,
      window: legacyWindow,
      gear: [...BASE_GEAR, ...SPECIES_GEAR[species]]
    }
  };
}
