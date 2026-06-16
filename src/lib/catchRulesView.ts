import type { SizeLimit, BagLimit, SubLimit } from './config/regs.js';

export function formatSize(s: SizeLimit): string {
  if (s.none) return 'No minimum size';
  if (s.minInches == null) return 'See notes';
  return `≥ ${s.minInches}″${s.measure ? ` ${s.measure}` : ''}`;
}

export function formatBag(b: BagLimit): string {
  if (b.none) return 'No bag limit';
  const unit = b.unit ?? 'fish';
  const daily = b.daily != null ? `${b.daily} / day` : '';
  const poss = b.possession != null ? ` · ${b.possession} possession` : '';
  return `${daily}${poss} ${unit}`.trim();
}

export function formatSubLimit(s: SubLimit): string {
  return `${s.species}: ${s.daily} / day${s.note ? ` (${s.note})` : ''}`;
}
