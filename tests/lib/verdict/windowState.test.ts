import { describe, it, expect } from 'vitest';
import { windowState } from '../../../src/lib/verdict/windowState.js';
import type { LaunchWindow } from '../../../src/lib/types.js';

const W: LaunchWindow = {
  label: 'Morning',
  launchAt: '06:10 PT',
  returnBy: '10:10 PT',
  checkInBy: '11:10 PT',
  launchAtMs: 1_000_000,
  returnByMs: 2_000_000
};

describe('windowState', () => {
  it('upcoming before launchAtMs', () => {
    expect(windowState(999_999, W)).toBe('upcoming');
  });
  it('active at launchAtMs (inclusive)', () => {
    expect(windowState(1_000_000, W)).toBe('active');
  });
  it('active at returnByMs (inclusive)', () => {
    expect(windowState(2_000_000, W)).toBe('active');
  });
  it('past after returnByMs', () => {
    expect(windowState(2_000_001, W)).toBe('past');
  });
  it('null when ms fields are absent (unmigrated payload)', () => {
    const bare: LaunchWindow = { label: 'x', launchAt: '06:10 PT', returnBy: '10:10 PT', checkInBy: '11:10 PT' };
    expect(windowState(1_000_000, bare)).toBeNull();
  });
});
