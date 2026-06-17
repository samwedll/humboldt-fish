export type Theme = 'light' | 'dark';
export type ThemePref = 'system' | Theme;

export const THEME_KEY = 'hf-theme';

/** Pure: resolve an effective theme from the user's preference + the system flag. */
export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): Theme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

export function getStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setStoredPref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage unavailable (private mode) — non-fatal */
  }
}

/** Read the OS preference. Guarded for SSR / jsdom (no matchMedia). */
export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

const CHROME = { light: '#0b2b40', dark: '#040c13' } as const;

/** Apply the effective theme to <html> + the theme-color meta. */
export function applyTheme(pref: ThemePref): Theme {
  const theme = resolveTheme(pref, systemPrefersDark());
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', CHROME[theme]);
  return theme;
}
