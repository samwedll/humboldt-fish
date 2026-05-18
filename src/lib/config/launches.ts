/**
 * Mirror of reference/launches.md (launch profiles and user personal rules).
 * Source of truth is the markdown file; this is the runtime copy.
 * When reference/launches.md changes, update this file in the same commit.
 */
import type { LaunchId } from '../types.js';

export interface LaunchProfile {
  id: LaunchId;
  label: string;
  openOcean: boolean;
  requiresSwellCheck: boolean;
  requiresPeriodCheck: boolean;
  requiresAlignmentCheck: boolean;
  requiresWindCheck: boolean;
  requiresTideAwareness: boolean;
  requiresBarCheck: boolean;
  soloInYearOne: boolean;
  coordinates: { lat: number; lon: number };
  tideStation: string;
  nwsZone: string;
  ndbcBuoyPrimary?: string;
  ndbcBuoySecondary?: string;
  /**
   * NOAA tidal-currents station ID. Set for launches where current speed/direction
   * materially affects launch/return timing (slough + bay interior).
   * Leave undefined for open-ocean Trinidad and the lagoons.
   */
  currentStation?: string;
  /**
   * True for coastal lagoons whose sandbar/spit can breach naturally or be
   * managed open by CDFW. When the spit is open, the lagoon's safety profile
   * changes substantially (currents through the breach, ocean swell wraparound,
   * rapid water-level changes). The Safety layer surfaces an advisory.
   */
  hasOceanFacingSpit?: boolean;
  notes: string;
}

export const launches: Record<LaunchId, LaunchProfile> = {
  trinidad: {
    id: 'trinidad',
    label: 'Trinidad Harbor',
    openOcean: true,
    requiresSwellCheck: true,
    requiresPeriodCheck: true,
    requiresAlignmentCheck: true,
    requiresWindCheck: true,
    requiresTideAwareness: false,
    requiresBarCheck: false,
    soloInYearOne: false,
    coordinates: { lat: 41.0586, lon: -124.1431 },
    tideStation: '9418723',
    nwsZone: 'PZZ450',
    ndbcBuoyPrimary: '46244',
    ndbcBuoySecondary: '46022',
    notes: 'Only open-Pacific launch per user rule. VHF 78 monitored locally.'
  },
  'big-lagoon': {
    id: 'big-lagoon',
    label: 'Big Lagoon',
    openOcean: false,
    requiresSwellCheck: false,
    requiresPeriodCheck: false,
    requiresAlignmentCheck: false,
    requiresWindCheck: true,
    requiresTideAwareness: false,
    requiresBarCheck: false,
    soloInYearOne: true,
    hasOceanFacingSpit: true,
    coordinates: { lat: 41.1736, lon: -124.1394 },
    tideStation: '9418723',
    nwsZone: 'PZZ450',
    notes:
      'Big Lagoon County Park paved ramp. Brackish, sheltered when the spit is closed. Wind is the only weather concern in normal closed-spit conditions.'
  },
  'stone-lagoon': {
    id: 'stone-lagoon',
    label: 'Stone Lagoon',
    openOcean: false,
    requiresSwellCheck: false,
    requiresPeriodCheck: false,
    requiresAlignmentCheck: false,
    requiresWindCheck: true,
    requiresTideAwareness: false,
    requiresBarCheck: false,
    soloInYearOne: true,
    hasOceanFacingSpit: true,
    coordinates: { lat: 41.2289, lon: -124.0975 },
    tideStation: '9418723',
    nwsZone: 'PZZ450',
    notes: 'Like Big Lagoon. Smaller water volume — breaches more reactively. Closed for cutthroat spawning Nov 21 – end of Feb (CDFW manages spit openings around fish-passage windows).'
  },
  'mad-river-slough': {
    id: 'mad-river-slough',
    label: 'Mad River Slough',
    openOcean: false,
    requiresSwellCheck: false,
    requiresPeriodCheck: false,
    requiresAlignmentCheck: false,
    requiresWindCheck: true,
    requiresTideAwareness: true,
    requiresBarCheck: false,
    soloInYearOne: true,
    coordinates: { lat: 40.9275, lon: -124.1119 },
    tideStation: '9418767',
    currentStation: 'HUB0203',
    nwsZone: 'PZZ450',
    notes:
      'Tidal but sheltered. Mud bottom — ride the flood in, ebb out. Plan return on flood.'
  },
  'humboldt-bay-interior': {
    id: 'humboldt-bay-interior',
    label: 'Humboldt Bay (interior)',
    openOcean: false,
    requiresSwellCheck: false,
    requiresPeriodCheck: false,
    requiresAlignmentCheck: false,
    requiresWindCheck: true,
    requiresTideAwareness: true,
    requiresBarCheck: false,
    soloInYearOne: true,
    coordinates: { lat: 40.8089, lon: -124.1644 },
    tideStation: '9418767',
    currentStation: 'HUB0203',
    nwsZone: 'PZZ450',
    notes:
      'Inside bay (Samoa, Fields, Woodley, Eureka Public ramps). Stay clear of entrance channel per user rule. Tide currents up to 3-5 kt; plan return on flood.'
  },
  'freshwater-lagoon': {
    id: 'freshwater-lagoon',
    label: 'Freshwater Lagoon',
    openOcean: false,
    requiresSwellCheck: false,
    requiresPeriodCheck: false,
    requiresAlignmentCheck: false,
    requiresWindCheck: true,
    requiresTideAwareness: false,
    requiresBarCheck: false,
    soloInYearOne: true,
    coordinates: { lat: 41.1850, lon: -124.1014 },
    tideStation: '9418723',
    nwsZone: 'PZZ450',
    notes:
      'Freshwater coastal lagoon in Humboldt Lagoons State Park. Closed water, no tide, no current. Easy paved ramp on the north side. Wind is the only weather concern. Stocked rainbow trout (CDFW schedule), bluegill, largemouth bass.'
  }
};

export function getLaunch(id: LaunchId): LaunchProfile {
  const l = launches[id];
  if (!l) throw new Error(`Unknown launch: ${id}`);
  return l;
}
