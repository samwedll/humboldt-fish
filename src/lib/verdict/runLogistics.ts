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
import { formatPacificTime, toPacificLocalISO, ptLocalIsoToEpochMs } from '../format.js';

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
 * Defensively normalize a "HH:MM PT" (or "H:MM PT") label to a zero-padded
 * "HH:MM" string for ISO reconstruction. Guards against runtimes where
 * Intl.DateTimeFormat may not zero-pad hours under en-US.
 */
function hhmmFromPtLabel(label: string): string {
  const stripped = label.replace(/\s*PT\s*$/, '').trim();
  const [hh, mm] = stripped.split(':');
  return `${hh.padStart(2, '0')}:${(mm ?? '00').padStart(2, '0')}`;
}

/** Integer launch hour (0–23) parsed from an "HH:MM PT" label. */
function launchHourOf(label: string): number {
  return Number(hhmmFromPtLabel(label).slice(0, 2));
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
  const peakInsideWindow =
    peakEvent !== undefined &&
    peakEvent.time >= windowStart &&
    peakEvent.time <= windowEnd;
  const peakSpeedKt = peakInsideWindow ? Math.abs(peakEvent!.velocityKt) : 0;
  const peakType: 'ebb' | 'flood' | 'slack' = peakInsideWindow ? peakEvent!.type : 'slack';
  const peakTimeLocal = peakInsideWindow ? ptIsoToHhmmLabel(peakEvent!.time) : ptIsoToHhmmLabel(windowStart);

  // Description.
  let description: string;
  if (phase === 'mixed') {
    const slack = inside.find((e) => e.type === 'slack')!;
    const peak = inside.find((e) => e.type !== 'slack');
    if (peak) {
      // Render the peak parenthetical adjacent to the phase it actually belongs
      // to (peak.type), not to the trailing phase — otherwise readers parse
      // "→ ebb (peaks 1.7 kt)" as describing the ebb when the magnitude is
      // actually on the preceding flood.
      const peakStr = `(peaks ${peakSpeedKt.toFixed(1)} kt at ${peak.time.slice(11, 16)})`;
      const otherPhase = peak.type === 'flood' ? 'ebb' : 'flood';
      const slackTime = slack.time.slice(11, 16);
      if (peak.time < slack.time) {
        description = `${peak.type} ${peakStr} → slack ${slackTime} → ${otherPhase}`;
      } else {
        description = `${otherPhase} → slack ${slackTime} → ${peak.type} ${peakStr}`;
      }
    } else {
      description = `slack ${slack.time.slice(11, 16)} mid-window`;
    }
  } else if (phase === 'flood' && peakInsideWindow) {
    description = `flood building, peaks ${peakSpeedKt.toFixed(1)} kt at ${peakTimeLocal.replace(' PT', '')}`;
  } else if (phase === 'ebb' && peakInsideWindow) {
    description = `ebb (peaks ${peakSpeedKt.toFixed(1)} kt at ${peakTimeLocal.replace(' PT', '')})`;
  } else if (phase === 'flood' || phase === 'ebb') {
    description = `${phase}-adjacent — no peak inside window`;
  } else {
    description = `slack`;
  }

  return { phase, peakSpeedKt, peakType, peakTimeLocal, description };
}

/**
 * Convert "YYYY-MM-DDTHH:MM" Pacific-local string to integer minutes since
 * an arbitrary epoch. We only diff within a single day, so a simple minute
 * count from a fixed origin works without any timezone math.
 */
function ptIsoToMinutes(iso: string): number {
  const [datePart, timePart] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const daysSince2000 =
    (y - 2000) * 365 + Math.floor((y - 2000) / 4) + (m - 1) * 31 + (d - 1);
  return daysSince2000 * 1440 + hh * 60 + mm;
}

function minutesToPtIso(totalMinutes: number, referenceDate: string): string {
  const refMin = ptIsoToMinutes(`${referenceDate}T00:00`);
  const dayMin = totalMinutes - refMin;
  if (dayMin < 0 || dayMin >= 1440) {
    throw new Error(
      `minutesToPtIso: totalMinutes ${totalMinutes} falls outside referenceDate ${referenceDate} (dayMin=${dayMin}). Launch windows are expected to stay within a single day.`
    );
  }
  const hh = Math.floor(dayMin / 60);
  const mm = dayMin % 60;
  return `${referenceDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Clamp returnBy so the trip ends before ebb builds past EBB_WARN_KT. Linear
 * interpolation between the preceding slack and the ebb peak gives a defensible
 * crossing-time estimate; subtract CLAMP_BUFFER_MIN for paddle-home margin.
 *
 * Returns:
 *   - { suppressed: false, newEnd: <ISO> } if no clamp or clamp leaves ≥ MIN_TRIP_HOURS
 *   - { suppressed: true, reason } if the window is shorter than MIN_TRIP_HOURS post-clamp,
 *     OR if launch is already in hostile ebb. `reason` is a short human-readable
 *     explanation suitable for a greyed-out window stub.
 */
export function clampReturnByForEbb(
  windowStart: string,
  windowEnd: string,
  currents: TidalCurrents
): { newEnd: string; suppressed: boolean; reason?: string } {
  const hostileEbbReason = `launch is already in a building ebb (> ${EBB_WARN_KT} kt) — the return leg would fight the current`;
  const events = currents.events;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== 'ebb' || Math.abs(e.velocityKt) <= EBB_WARN_KT) continue;

    if (e.time < windowStart) {
      // Ebb peak before window start. Check if launch is on the descending
      // side of this peak (still above threshold).
      const prevSlack = events.slice(0, i).reverse().find((p) => p.type === 'slack');
      const nextSlack = events.slice(i + 1).find((p) => p.type === 'slack');
      if (!prevSlack || !nextSlack) continue;
      if (windowStart >= prevSlack.time && windowStart <= nextSlack.time) {
        const launchVel = interpEbbMagnitude(
          windowStart,
          prevSlack.time,
          e.time,
          nextSlack.time,
          Math.abs(e.velocityKt)
        );
        if (launchVel > EBB_WARN_KT)
          return { suppressed: true, newEnd: windowEnd, reason: hostileEbbReason };
      }
      continue;
    }

    // e.time >= windowStart. Linear-interpolate the rising-ebb side.
    const prevSlack = events.slice(0, i).reverse().find((p) => p.type === 'slack');
    if (!prevSlack) continue;

    const slackMin = ptIsoToMinutes(prevSlack.time);
    const peakMin = ptIsoToMinutes(e.time);
    const startMin = ptIsoToMinutes(windowStart);
    const endMin = ptIsoToMinutes(windowEnd);

    // Launch-time velocity (only if launch is already on the rising side).
    if (startMin >= slackMin && startMin <= peakMin) {
      const launchFrac = (startMin - slackMin) / (peakMin - slackMin);
      const launchVel = Math.abs(e.velocityKt) * Math.sin((Math.PI / 2) * launchFrac);
      if (launchVel > EBB_WARN_KT)
        return { suppressed: true, newEnd: windowEnd, reason: hostileEbbReason };
    }

    // Threshold-crossing time on the rising side.
    let crossingMin: number | null = null;
    if (startMin <= peakMin && endMin >= slackMin) {
      // Sinusoidal inversion: |v|(frac) = peakMag * sin(pi/2 * frac)
      // => frac = (2/pi) * asin(|v| / peakMag)
      const frac = (2 / Math.PI) * Math.asin(EBB_WARN_KT / Math.abs(e.velocityKt));
      const t = Math.floor(slackMin + (peakMin - slackMin) * frac);
      if (t >= startMin && t <= endMin) crossingMin = t;
    }

    if (crossingMin === null) continue;

    const clampedEndMin = crossingMin - CLAMP_BUFFER_MIN;
    if (clampedEndMin <= startMin || (clampedEndMin - startMin) < MIN_TRIP_HOURS * 60) {
      const crossingLabel = `${minutesToPtIso(crossingMin, windowStart.slice(0, 10)).slice(11, 16)} PT`;
      return {
        suppressed: true,
        newEnd: windowEnd,
        reason: `ebb builds past ${EBB_WARN_KT} kt by ~${crossingLabel} — a safe trip would be under ${MIN_TRIP_HOURS} h`
      };
    }
    const dateRef = windowStart.slice(0, 10);
    return { newEnd: minutesToPtIso(clampedEndMin, dateRef), suppressed: false };
  }

  return { newEnd: windowEnd, suppressed: false };
}

/**
 * Sinusoidal magnitude model for a slack-peak-slack ebb half-cycle.
 * Linear interp under-estimates current near the peak by ~10-15%, which makes
 * the clamp fire slightly later than it should (less safe). Using
 * peakMag * sin(pi/2 * t_frac) on each half puts magnitude growth right where
 * tides actually grow fastest — near slack — and flattens near the peak.
 */
function interpEbbMagnitude(
  t: string,
  slackBefore: string,
  peak: string,
  slackAfter: string,
  peakMag: number
): number {
  const tMin = ptIsoToMinutes(t);
  const slackBeforeMin = ptIsoToMinutes(slackBefore);
  const peakMin = ptIsoToMinutes(peak);
  const slackAfterMin = ptIsoToMinutes(slackAfter);
  if (tMin <= peakMin) {
    const frac = (tMin - slackBeforeMin) / (peakMin - slackBeforeMin);
    return peakMag * Math.sin((Math.PI / 2) * frac);
  } else {
    const frac = (slackAfterMin - tMin) / (slackAfterMin - peakMin);
    return peakMag * Math.sin((Math.PI / 2) * frac);
  }
}

/**
 * Build a slack-anchored morning launch window. Symmetric counterpart to the
 * existing afternoon-slack block in runLogistics. Looks for a slack in
 * 04:00–11:00 Pacific local on `date`.
 *
 * Returns null only when there is no qualifying morning slack at all. When a
 * slack exists but launching ~30 min ahead of it would fall before civil dawn,
 * the window is returned as a *suppressed stub* (not dropped) so the UI can show
 * the user why no morning-slack launch is offered.
 */
export function buildMorningSlackWindow(
  currents: TidalCurrents,
  date: string,
  civilDawn: Date
): LaunchWindow | null {
  const morningSlack = currents.events.find(
    (e) =>
      e.type === 'slack' &&
      e.time.startsWith(date) &&
      hourOf(e.time) >= 4 &&
      hourOf(e.time) <= 11
  );
  if (!morningSlack) return null;

  const launchAtIso = shiftPtIso(morningSlack.time, -30);
  const civilDawnIso = toPacificLocalISO(civilDawn);

  const launchAt = `${launchAtIso.slice(11, 16)} PT`;
  const returnByIso = shiftPtIso(launchAtIso, 4 * 60);
  const returnBy = `${returnByIso.slice(11, 16)} PT`;
  const checkInByIso = shiftPtIso(returnByIso, 60);
  const checkInBy = `${checkInByIso.slice(11, 16)} PT`;

  const window: LaunchWindow = {
    label: `Around ${morningSlack.time.slice(11, 16)} slack`,
    launchAt,
    returnBy,
    checkInBy,
    rationale:
      'Tide-driven — launch ~30 min before slack, fish through the turn, return on the building tide.'
  };

  if (launchAtIso < civilDawnIso) {
    window.suppressed = true;
    window.suppressedReason = `slack ${morningSlack.time.slice(11, 16)} is before first light — launching ~30 min ahead (${launchAt}) would be before civil dawn ${civilDawnIso.slice(11, 16)} PT`;
  }

  return window;
}

/** Shift a "YYYY-MM-DDTHH:MM" PT-local string by N minutes (positive or negative). */
function shiftPtIso(iso: string, deltaMinutes: number): string {
  const totalMin = ptIsoToMinutes(iso) + deltaMinutes;
  return minutesToPtIso(totalMin, iso.slice(0, 10));
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

  // Held so the window-suppression logic below can append a note when a morning
  // slack exists but no compliant morning launch window survives.
  let tidalCurrentsCheck: Check | undefined;

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
          tidalCurrentsCheck = {
            layer: 'logistics',
            name: 'Tidal currents',
            value: parts.join('; '),
            threshold: '—',
            status: 'pass',
            note: 'Launch on the last 90 min of flood or at slack. Return before the ebb builds past 1.5 kt.'
          };
          checks.push(tidalCurrentsCheck);
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

  // ============================================================
  // Slack-anchored windows + tide annotation + clamp
  // ============================================================

  // 1. Build morning + afternoon slack windows when available.
  if (launchProfile.currentStation && data.tidalCurrents && sun) {
    const civilDawn = new Date(sun.civilDawn);
    const morningSlack = buildMorningSlackWindow(data.tidalCurrents, date, civilDawn);
    if (morningSlack) windows.push(morningSlack);

    // Afternoon slack window (existing behavior, kept).
    const slacks = data.tidalCurrents.events.filter(
      (e) => e.type === 'slack' && e.time.startsWith(date)
    );
    const afternoonSlack = slacks.find((e) => {
      const hr = Number(e.time.slice(11, 13));
      return hr >= 12 && hr < 18;
    });
    if (afternoonSlack) {
      windows.push({
        label: `Around ${afternoonSlack.time.slice(11, 16)} slack`,
        launchAt: shiftPacificTime(afternoonSlack.time, -30),
        returnBy: shiftPacificTime(afternoonSlack.time, -30 + 4 * 60),
        checkInBy: shiftPacificTime(afternoonSlack.time, -30 + 5 * 60),
        rationale: 'Tide-driven — launch ~30 min before slack, fish through the turn, return on the building tide.'
      });
    }
  }

  // 2. Annotate dawn/dusk windows + clamp returnBy + set warnings.
  if (launchProfile.currentStation && data.tidalCurrents) {
    const annotated: LaunchWindow[] = [];
    for (const w of windows) {
      const isSlackAnchored = /slack/i.test(w.label);

      // Reconstruct the window's [launchStart, launchEnd] as Pacific-local ISO.
      const launchIso = `${date}T${hhmmFromPtLabel(w.launchAt)}`;
      const returnIso = `${date}T${hhmmFromPtLabel(w.returnBy)}`;

      // Annotate against the pre-clamp range.
      const tide = annotateWindowWithTide(launchIso, returnIso, data.tidalCurrents);
      const annotatedW: LaunchWindow = { ...w, tide };

      if (isSlackAnchored) {
        // Slack-anchored windows skip warning + clamp by design. The window
        // is built around slack ± 30 min with a 4h trailing range. This
        // implicitly assumes the post-slack half-cycle is the SAFE direction
        // (flood inbound or moderate ebb), which holds for the typical
        // semidiurnal pattern at HUB0203 (slack → flood → slack → ebb).
        // If NOAA ever returns a slack between two ebbs (rare; mixed
        // semidiurnal phase inversion), a slack-anchored window could put
        // the kayaker returning through ebb without a warning. Watch for
        // this in real-trip data; consider adding clamp logic here if a
        // counter-example shows up.
        //
        // A pre-dawn slack window arrives already flagged `suppressed`; we keep
        // it as-is so the UI renders it as a greyed stub with its reason.
        annotated.push(annotatedW);
        continue;
      }

      // Clamp + suppression FIRST. A suppressed window is no longer dropped —
      // it's kept as a greyed stub carrying its reason, so the user can see
      // why a morning/evening launch isn't on offer. Warnings are only set on
      // windows that survive (a suppressed window's reason supersedes them).
      const clamp = clampReturnByForEbb(launchIso, returnIso, data.tidalCurrents);
      if (clamp.suppressed) {
        annotatedW.suppressed = true;
        annotatedW.suppressedReason = clamp.reason;
        annotated.push(annotatedW);
        continue;
      }

      // Surviving window: pre-clamp warning check (drive off peakType, not phase).
      if (tide.peakType === 'ebb' && tide.peakSpeedKt > EBB_WARN_KT) {
        annotatedW.warning = `ebb peaks ${tide.peakSpeedKt.toFixed(1)} kt at ${tide.peakTimeLocal.replace(' PT', '')} — return through building current`;
      } else if (tide.peakType === 'flood' && tide.peakSpeedKt > FLOOD_WARN_KT) {
        annotatedW.warning = `flood peaks ${tide.peakSpeedKt.toFixed(1)} kt at ${tide.peakTimeLocal.replace(' PT', '')} — control trade-off on assist`;
      }

      if (clamp.newEnd !== returnIso) {
        const newReturnHhmm = `${clamp.newEnd.slice(11, 16)} PT`;
        annotatedW.returnBy = newReturnHhmm;
        const newCheckMinutes = ptIsoToMinutes(clamp.newEnd) + 60;
        const dayStartMin = ptIsoToMinutes(`${date}T00:00`);
        if (newCheckMinutes - dayStartMin < 1440) {
          const newCheckIso = minutesToPtIso(newCheckMinutes, date);
          annotatedW.checkInBy = `${newCheckIso.slice(11, 16)} PT`;
        } else {
          // Would cross midnight — cap at 23:59 PT rather than throwing.
          annotatedW.checkInBy = '23:59 PT';
        }
      }

      annotated.push(annotatedW);
    }
    windows.length = 0;
    windows.push(...annotated);

    // If a morning slack exists but no LIVE morning window survived, annotate
    // the Tidal-currents check so the card explains the mismatch the user would
    // otherwise hit: "it reports a morning slack, yet offers no morning launch."
    const morningSlackExists = !!summarizeCurrents(data.tidalCurrents, date).morningSlack;
    const hasLiveMorning = windows.some((w) => !w.suppressed && launchHourOf(w.launchAt) < 12);
    if (windows.length > 0 && morningSlackExists && !hasLiveMorning && tidalCurrentsCheck) {
      const reasons = windows
        .filter((w) => w.suppressed && launchHourOf(w.launchAt) < 12)
        .map((w) => `${w.label} — ${w.suppressedReason}`);
      const detail = reasons.length
        ? reasons.join('; ')
        : 'the morning currents leave no compliant 2 h trip';
      tidalCurrentsCheck.note =
        `${tidalCurrentsCheck.note ?? ''} No compliant morning launch window despite the slack: ${detail}.`.trim();
    }
  }

  // Legacy single-window string for any consumer that hasn't migrated (incl. the
  // planned MCP server). Use the first LIVE window only — when every window is
  // suppressed there is no launchable trip, so this must be undefined rather than
  // describe a non-launchable stub. A suppressed window must never read as launchable.
  const legacyAnchor = windows.find((w) => !w.suppressed);
  const legacyWindow = legacyAnchor
    ? `Launch ${legacyAnchor.launchAt}, return by ${legacyAnchor.returnBy} (4-hour trip cap)`
    : undefined;

  // Epoch-ms twins for client-side time-awareness. All window strings are
  // same-date PT labels (minutesToPtIso enforces single-day; checkInBy is
  // capped at 23:59 PT), so date + label reconstruction is safe.
  const withMs = (w: LaunchWindow): LaunchWindow => ({
    ...w,
    launchAtMs: ptLocalIsoToEpochMs(`${date}T${hhmmFromPtLabel(w.launchAt)}`),
    returnByMs: ptLocalIsoToEpochMs(`${date}T${hhmmFromPtLabel(w.returnBy)}`),
    checkInByMs: ptLocalIsoToEpochMs(`${date}T${hhmmFromPtLabel(w.checkInBy)}`)
  });

  return {
    result: { status: 'pass', summary: `${launchProfile.label}, ${species}` },
    checks,
    recommendations: {
      windows: windows.length > 0 ? windows.map(withMs) : undefined,
      window: legacyWindow,
      gear: [...BASE_GEAR, ...SPECIES_GEAR[species]]
    }
  };
}
