/**
 * Pre-launch checklist for the "Right now" verdict — the manual verifications
 * the pipeline cannot perform. Each item cites its reference/ source.
 * Display-only: no persisted check state.
 */
import type { Species, LaunchId, ChecklistItem } from '../types.js';
import { getLaunch } from './launches.js';
import { regs } from './regs.js';

// Mirrors the dawn+30 morning-launch offset in runLogistics; spec pins the
// low-light trigger to ±30 min of civil dawn/dusk.
const LOW_LIGHT_MARGIN_MS = 30 * 60_000;

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
    { id: 'bar-status', label: 'USCG bar status (or VHF 22A)', phone: '707-839-6113' }
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
    ctx.launchAtMs < ctx.dawnMs + LOW_LIGHT_MARGIN_MS ||
    ctx.returnByMs > ctx.duskMs - LOW_LIGHT_MARGIN_MS
  ) {
    // reference/thresholds.md: pre-dawn/low-light preconditions
    items.push({ id: 'low-light', label: 'Low-light margins: nav light on, float plan filed, VHF checked' });
  }
  return items;
}
