import type { LaunchWindow, WindowState } from '../types.js';

/**
 * Where a launch window sits relative to wall-clock. Returns null when the
 * window has no epoch-ms fields (payload from a pre-migration server).
 * Boundaries are inclusive: at launchAtMs or returnByMs the window is active.
 */
export function windowState(nowMs: number, w: LaunchWindow): WindowState | null {
  if (w.launchAtMs === undefined || w.returnByMs === undefined) return null;
  if (nowMs < w.launchAtMs) return 'upcoming';
  if (nowMs > w.returnByMs) return 'past';
  return 'active';
}
