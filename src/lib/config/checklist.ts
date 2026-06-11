/**
 * Pre-launch checklist for the "Right now" verdict — the manual verifications
 * the pipeline cannot perform. Each item cites its reference/ source.
 * Display-only: no persisted check state.
 */
import type { Species, LaunchId, ChecklistItem } from '../types.js';
import { getLaunch } from './launches.js';
import { regs } from './regs.js';
import { barStatus } from './sources.js';

// Earliest permitted launch is civil dawn + 30 (runLogistics morning-window
// convention). Low-light gear applies to launches in the twilight band just
// after that — within 30 min of the earliest launch (≈ up to sunrise at this
// latitude) — and to returns landing within 30 min of civil dusk. Boundaries
// inclusive: the canonical twilight-launch instant itself needs the gear.
const LOW_LIGHT_MARGIN_MS = 30 * 60_000;
const EARLIEST_LAUNCH_OFFSET_MS = 30 * 60_000;

export function checklistFor(ctx: {
  species: Species;
  launch: LaunchId;
  launchAtMs: number;
  returnByMs: number;
  dawnMs: number;
  duskMs: number;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    // reference/SKILL.md canonical footer: verify bar status within 2 h of launch
    { id: 'bar-status', label: 'USCG bar status (or VHF 22A)', phone: barStatus.phone }
  ];
  if (ctx.species === 'salmon') {
    // reference/regs/: hotline call is mandatory before a salmon trip
    items.push({ id: 'salmon-hotline', label: 'CDFW salmon hotline — must call', phone: regs.salmon.hotlinePhone });
  }
  const profile = getLaunch(ctx.launch);
  if (profile.hasOceanFacingSpit) {
    // reference/launches.md: open spit changes the lagoon's safety profile entirely
    items.push({ id: 'spit-status', label: `Verify ${profile.label} spit is closed (visual or park advisories)` });
  }
  if (
    ctx.launchAtMs <= ctx.dawnMs + EARLIEST_LAUNCH_OFFSET_MS + LOW_LIGHT_MARGIN_MS ||
    ctx.returnByMs >= ctx.duskMs - LOW_LIGHT_MARGIN_MS
  ) {
    // reference/thresholds.md: pre-dawn/low-light preconditions
    items.push({ id: 'low-light', label: 'Low-light margins: nav light on, float plan filed, VHF checked' });
  }
  return items;
}
