import type { Species, LaunchId, LayerResult, Check } from '../types.js';
import { isSpeciesOpen, regs } from '../config/regs.js';
import { isSpeciesLaunchCompatible } from '../config/species-launch.js';
import { getLaunch } from '../config/launches.js';

export interface LegalInput {
  species: Species;
  launch: LaunchId;
  date: string;
}
export interface LayerOutput {
  result: LayerResult;
  checks: Check[];
}

export function runLegal({ species, launch, date }: LegalInput): LayerOutput {
  const checks: Check[] = [];
  const r = regs[species];
  const launchProfile = getLaunch(launch);
  const compatible = isSpeciesLaunchCompatible(species, launch);

  checks.push({
    layer: 'legal',
    name: 'Species at launch',
    value: `${species} at ${launch}`,
    threshold: 'species compatible with launch',
    status: compatible ? 'pass' : 'fail',
    note: compatible
      ? undefined
      : `${species} is not realistically targeted at ${launchProfile.label}. Pick a different launch or a different species.`
  });

  const season = isSpeciesOpen(species, date);
  checks.push({
    layer: 'legal',
    name: 'Season',
    value: season.open ? 'open' : 'closed',
    threshold: r.seasonWindows.map((w) => `${w.start}–${w.end}`).join(', '),
    status: season.open ? 'pass' : 'fail',
    note: season.reason
  });

  if (r.requiresHotlineVerify && r.hotlinePhone && season.open && compatible) {
    checks.push({
      layer: 'legal',
      name: 'Salmon hotline verify',
      value: 'required',
      threshold: 'call within 2h of launch',
      status: 'pass',
      note: `${r.hotlineLabel}: ${r.hotlinePhone}`
    });
  }

  const failed = checks.some((c) => c.status === 'fail');
  let summary: string;
  if (!compatible) {
    summary = `${species} cannot be targeted at ${launchProfile.label}`;
  } else if (!season.open) {
    summary = `${r.label} not in season on ${date}`;
  } else {
    summary = `${r.label} in season at ${launchProfile.label}`;
  }
  return {
    result: {
      status: failed ? 'fail' : 'pass',
      summary
    },
    checks
  };
}
