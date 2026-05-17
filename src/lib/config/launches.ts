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
    coordinates: { lat: 41.1736, lon: -124.1394 },
    tideStation: '9418723',
    nwsZone: 'PZZ450',
    notes:
      'Big Lagoon County Park paved ramp. Brackish, sheltered. Wind is the only weather concern.'
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
    coordinates: { lat: 41.2289, lon: -124.0975 },
    tideStation: '9418723',
    nwsZone: 'PZZ450',
    notes: 'Like Big Lagoon. Closed for cutthroat spawning Nov 21 – end of Feb.'
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
    nwsZone: 'PZZ450',
    notes:
      'Inside bay (Samoa, Fields, Woodley, Eureka Public ramps). Stay clear of entrance channel per user rule. Tide currents up to 3-5 kt; plan return on flood.'
  }
};

export function getLaunch(id: LaunchId): LaunchProfile {
  const l = launches[id];
  if (!l) throw new Error(`Unknown launch: ${id}`);
  return l;
}
