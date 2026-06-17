import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTheme, getStoredPref, setStoredPref, THEME_KEY, type ThemePref } from '../../src/lib/theme.js';

describe('resolveTheme', () => {
  it('system pref follows the system flag', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('explicit pref ignores the system flag', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('stored preference', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to system when nothing stored', () => {
    expect(getStoredPref()).toBe('system');
  });
  it('round-trips a stored pref', () => {
    setStoredPref('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(getStoredPref()).toBe('dark');
  });
  it('treats an invalid stored value as system', () => {
    localStorage.setItem(THEME_KEY, 'banana' as ThemePref);
    expect(getStoredPref()).toBe('system');
  });
});
