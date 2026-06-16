# Marine Instrument, dark-first — Frontend Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace humboldt.fish's unstyled look with a distinctive "Marine Instrument, dark-first" design system (Inter + IBM Plex Mono, semantic light/dark tokens, an inline-SVG icon set, a bolder verdict status panel, auto theme + sun/moon override) without touching decision logic, thresholds, data, IA, or safety copy.

**Architecture:** All theming flows through CSS custom properties defined in `src/app.css` for a light "day" `:root` and a dark "dawn" `[data-theme="dark"]`, with `prefers-color-scheme` as the default and an explicit `localStorage` override. Tailwind color/font utilities are repointed at those variables so most existing utility classes remap without per-element rewrites. Glyphs/emoji are centralized into a single `Icon.svelte`; colored callouts into shared `.callout-*` classes. Verdict logic, fetchers, config, and `reference/` are untouched.

**Tech Stack:** SvelteKit 5 (runes), Tailwind v3, Vitest 4 + @testing-library/svelte + jsdom, `@vite-pwa/sveltekit`, self-hosted fonts via `@fontsource`.

**Spec:** `docs/superpowers/specs/2026-06-16-frontend-marine-instrument-design.md`

**Branch:** `feat/frontend-marine-instrument` (already created; the spec is committed here).

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/app.css` | Modify | Font imports; CSS token vars (light + dark + system); `.callout-*` component classes; base element colors |
| `tailwind.config.js` | Modify | Repoint colors at tokens; register `sans`/`mono` font families |
| `src/app.html` | Modify | No-flash theme bootstrap script; theme-color meta managed by theme |
| `src/lib/theme.ts` | Create | Theme preference resolution + persistence (pure + DOM helpers) |
| `src/lib/components/Icon.svelte` | Create | Inline-SVG icon set (`currentColor`), replaces all emoji/glyphs |
| `src/lib/components/VerdictPanel.svelte` | Create | Today's verdict as a tinted, color-ruled status panel |
| `src/lib/components/ThemeToggle.svelte` | Create | Sun/moon override button wired to `theme.ts` |
| `src/lib/components/VerdictPill.svelte` | Modify | Token-based small pill for next-days rows |
| `src/lib/components/LayerTable.svelte` | Modify | Status `Icon` + token styling |
| `src/lib/components/NowStrip.svelte` | Modify | `Icon` + token styling |
| `src/lib/components/DayCard.svelte` | Modify | Token cards; `VerdictPanel` for today; window-state dots; emoji→`Icon` |
| `src/lib/components/CatchRulesCard.svelte` | Modify | warn `Icon`; token styling |
| `src/lib/components/RegRow.svelte` | Modify | Token styling |
| `src/lib/components/VerifyBadge.svelte` | Modify | warn `Icon`; token styling |
| `src/routes/+layout.svelte` | Modify | Wordmark lockup, instrument tabs, `ThemeToggle`, callout banner/footer |
| `src/routes/+page.svelte` | Modify | refresh `Icon`; token styling |
| `src/routes/rules/+page.svelte` | Modify | Token styling |
| `tests/lib/theme.test.ts` | Create | `theme.ts` resolution/persistence tests |
| `tests/lib/components/Icon.test.ts` | Create | `Icon` renders expected symbol per name |
| `tests/lib/components/VerdictPanel.test.ts` | Create | Panel renders verdict word + reason + verdict color |
| `tests/lib/components/DayCard.test.ts` | Modify | Window-state assertions updated to label-only text |

## Token mapping cheat-sheet (used by all restyle tasks)

Apply these substitutions wherever the old class appears. Where a `.callout-*` class fits, prefer it over raw token classes.

| Old utility | New |
|---|---|
| `bg-white` | `bg-surface` |
| `bg-neutral-50`, `bg-neutral-100` | `bg-surface2` |
| `border-neutral-200`, `border-neutral-300` | `border-line` |
| `text-neutral-900`, `text-neutral-800` | `text-ink` |
| `text-neutral-700`, `-600`, `-500`, `-400` | `text-muted` |
| `text-green-600` | `text-verdict-go` |
| `text-yellow-600` | `text-verdict-conditional` |
| `text-red-600` | `text-verdict-nogo` |
| `text-sky-700` (tide) | `text-accent` |
| red banner `border-red-300 bg-red-50 text-red-800` | `class="callout-danger"` |
| amber blocks `border-yellow-300 bg-yellow-50 text-yellow-900` / `border-amber-300 bg-amber-50` | `class="callout-caution"` |
| sky block `border-sky-300 bg-sky-50` | `class="callout-info"` |

**Invariants for every restyle task (do not break):**
- Keep all `data-testid` attributes: `source-chip`, `window-state`, `suppressed-window`, `tidal-currents-block`, `now-strip`.
- Keep all visible text and `tel:`/source links verbatim; keep `sr-only` and `aria-*` attributes.
- Icons are decorative: pass `aria-hidden` (handled inside `Icon.svelte`); meaning stays in adjacent text.
- No edits to `src/lib/verdict/*`, `src/lib/fetchers/*`, `src/lib/config/*`, `src/lib/server/*`, `reference/*`, `src/routes/api/*`, `src/routes/+page.server.ts`.

---

## Task 1: Design tokens + Tailwind wiring + callout classes

**Files:**
- Modify: `src/app.css`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace `src/app.css` with token system**

Replace the entire contents of `src/app.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Light "day" — default */
  :root {
    --bg: #eef3f7;
    --surface: #ffffff;
    --surface2: #f1f6fa;
    --chrome: #0b2b40;
    --line: #dde8f0;
    --ink: #16242e;
    --muted: #5a7286;
    --accent: #0ea5e9;
    --v-go: #16a34a;
    --v-cond: #ca8a04;
    --v-nogo: #dc2626;
    --v-inc: #64748b;
    --on-chrome: #ffffff;
    --on-accent: #062234;
  }

  /* Dark "dawn" — the hero. Applied when the user forces dark,
     or when following the system and the system is dark. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --bg: #081420;
      --surface: #0d1f2e;
      --surface2: #0a1b29;
      --chrome: #040c13;
      --line: #173143;
      --ink: #e7f0f7;
      --muted: #7e9bb0;
      --accent: #38bdf8;
      --v-go: #2fd07a;
      --v-cond: #f5b942;
      --v-nogo: #ff5a5a;
      --v-inc: #9fb2c0;
      --on-chrome: #ffffff;
      --on-accent: #04212f;
    }
  }
  [data-theme='dark'] {
    --bg: #081420;
    --surface: #0d1f2e;
    --surface2: #0a1b29;
    --chrome: #040c13;
    --line: #173143;
    --ink: #e7f0f7;
    --muted: #7e9bb0;
    --accent: #38bdf8;
    --v-go: #2fd07a;
    --v-cond: #f5b942;
    --v-nogo: #ff5a5a;
    --v-inc: #9fb2c0;
    --on-chrome: #ffffff;
    --on-accent: #04212f;
  }

  html {
    font-family: 'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--ink);
  }
}

@layer components {
  /* Colored callouts — semantic, dual-theme. Used for safety/warning/info blocks. */
  .callout-danger {
    border: 1px solid color-mix(in srgb, var(--v-nogo) 45%, var(--line));
    background: color-mix(in srgb, var(--v-nogo) 12%, var(--surface));
    color: color-mix(in srgb, var(--v-nogo) 60%, var(--ink));
  }
  .callout-caution {
    border: 1px solid color-mix(in srgb, var(--v-cond) 45%, var(--line));
    background: color-mix(in srgb, var(--v-cond) 12%, var(--surface));
    color: color-mix(in srgb, var(--v-cond) 55%, var(--ink));
  }
  .callout-info {
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    color: color-mix(in srgb, var(--accent) 55%, var(--ink));
  }
}
```

- [ ] **Step 2: Repoint Tailwind colors + register fonts**

Replace the entire contents of `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        chrome: 'var(--chrome)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'on-chrome': 'var(--on-chrome)',
        'on-accent': 'var(--on-accent)',
        verdict: {
          go: 'var(--v-go)',
          conditional: 'var(--v-cond)',
          nogo: 'var(--v-nogo)',
          incomplete: 'var(--v-inc)'
        }
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 3: Verify the project still type-checks and builds**

Run: `npm run check`
Expected: PASS (0 errors). The token classes are not yet referenced anywhere, so nothing breaks.

- [ ] **Step 4: Verify tests still pass**

Run: `npm test`
Expected: PASS — existing components still use old utilities; no behavior changed.

- [ ] **Step 5: Commit**

```bash
git add src/app.css tailwind.config.js
git commit -m "feat(ui): design tokens, theme-aware Tailwind colors, callout classes"
```

---

## Task 2: Self-hosted fonts (Inter + IBM Plex Mono)

Self-hosted via `@fontsource` (bundled into the client build → precached by the PWA plugin's default `client/**` glob → works offline). Chosen over manual subsetting to avoid extra tooling; two small dev deps that earn their keep for the offline PWA.

**Files:**
- Modify: `package.json` (deps)
- Modify: `src/app.css` (font imports)

- [ ] **Step 1: Install the font packages**

Run:
```bash
pnpm add -D @fontsource-variable/inter @fontsource/ibm-plex-mono
```
Expected: both added to `devDependencies`.

- [ ] **Step 2: Import the needed faces at the top of `src/app.css`**

Add these imports as the **very first lines** of `src/app.css`, above `@tailwind base;` (CSS `@import` must precede other rules):

```css
@import '@fontsource-variable/inter';
@import '@fontsource/ibm-plex-mono/400.css';
@import '@fontsource/ibm-plex-mono/500.css';
@import '@fontsource/ibm-plex-mono/600.css';
```

- [ ] **Step 3: Build to confirm fonts bundle and precache**

Run: `npm run build`
Expected: PASS. Confirm woff2 assets appear in the build output:
```bash
find .svelte-kit -name "*.woff2" | head
```
Expected: at least one Inter and one IBM Plex Mono `.woff2` listed.

- [ ] **Step 4: Verify tests still pass**

Run: `npm test`
Expected: PASS (jsdom ignores `@import`/fonts; no assertions affected).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/app.css
git commit -m "feat(ui): self-host Inter + IBM Plex Mono via @fontsource"
```

---

## Task 3: Theme resolution + persistence (`theme.ts`)

**Files:**
- Create: `src/lib/theme.ts`
- Test: `tests/lib/theme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/theme.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/lib/theme.test.ts`
Expected: FAIL — `src/lib/theme.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/theme.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/lib/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts tests/lib/theme.test.ts
git commit -m "feat(ui): theme preference resolution + persistence"
```

---

## Task 4: No-flash theme bootstrap in `app.html`

**Files:**
- Modify: `src/app.html`

- [ ] **Step 1: Add the bootstrap script + keep the meta tag**

In `src/app.html`, replace the `<meta name="theme-color" ... />` line with the meta tag followed by an inline bootstrap script, so the `<head>` reads:

```html
		<meta name="theme-color" content="#0c4a6e" />
		<script>
			// Set the theme before first paint to avoid a flash. Mirrors src/lib/theme.ts.
			(function () {
				try {
					var p = localStorage.getItem('hf-theme');
					var pref = p === 'light' || p === 'dark' ? p : 'system';
					var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
					if (pref !== 'system') document.documentElement.setAttribute('data-theme', pref);
					var meta = document.querySelector('meta[name="theme-color"]');
					if (meta) meta.setAttribute('content', dark ? '#040c13' : '#0b2b40');
				} catch (e) {}
			})();
		</script>
```

- [ ] **Step 2: Verify build still succeeds**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app.html
git commit -m "feat(ui): no-flash theme bootstrap in app shell"
```

---

## Task 5: Icon component (retire emoji)

**Files:**
- Create: `src/lib/components/Icon.svelte`
- Test: `tests/lib/components/Icon.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/components/Icon.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Icon from '../../../src/lib/components/Icon.svelte';

describe('Icon', () => {
  it('renders an aria-hidden svg for a known name', () => {
    const { container } = render(Icon, { props: { name: 'check' } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders distinct paths for different names', () => {
    const a = render(Icon, { props: { name: 'check' } }).container.innerHTML;
    const b = render(Icon, { props: { name: 'warn' } }).container.innerHTML;
    expect(a).not.toBe(b);
  });

  it('applies a passed class', () => {
    const { container } = render(Icon, { props: { name: 'tide', class: 'text-accent' } });
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-accent');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/lib/components/Icon.test.ts`
Expected: FAIL — `Icon.svelte` does not exist.

- [ ] **Step 3: Implement `src/lib/components/Icon.svelte`**

```svelte
<script lang="ts" module>
  // 24x24 viewBox, stroke uses currentColor. Inner markup per icon name.
  export type IconName =
    | 'check' | 'x' | 'warn' | 'question' | 'tide' | 'copy'
    | 'block' | 'refresh' | 'sun' | 'moon' | 'info' | 'external';

  const PATHS: Record<IconName, string> = {
    check: '<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    warn: '<path d="M12 3.5l8.5 15H3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor"/>',
    question: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.4 9.2a2.7 2.7 0 1 1 3.6 2.6c-.9.5-1 .9-1 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor"/>',
    tide: '<path d="M2 9c2-2.4 4.3-2.4 6.3 0s4.3 2.4 6.3 0 4.3-2.4 6.3 0M2 15c2-2.4 4.3-2.4 6.3 0s4.3 2.4 6.3 0 4.3-2.4 6.3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    copy: '<rect x="5.5" y="4.5" width="13" height="16" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 4.5h6v2.2H9z" fill="currentColor"/>',
    block: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 12h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.2 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 5v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    sun: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8M11 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  export function iconMarkup(name: IconName): string {
    return PATHS[name];
  }
</script>

<script lang="ts">
  type Props = { name: IconName; size?: number | string; class?: string };
  let { name, size = '1em', class: klass = '' }: Props = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  class={klass}
  aria-hidden="true"
  focusable="false"
>{@html iconMarkup(name)}</svg>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/lib/components/Icon.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Icon.svelte tests/lib/components/Icon.test.ts
git commit -m "feat(ui): inline-SVG Icon component (replaces emoji)"
```

---

## Task 6: ThemeToggle component

**Files:**
- Create: `src/lib/components/ThemeToggle.svelte`

- [ ] **Step 1: Implement `src/lib/components/ThemeToggle.svelte`**

```svelte
<script lang="ts">
  import Icon from './Icon.svelte';
  import { getStoredPref, setStoredPref, applyTheme, systemPrefersDark, resolveTheme, type Theme } from '$lib/theme.js';

  // Effective theme drives which glyph shows. Initialised from storage on mount.
  let theme = $state<Theme>('light');

  $effect(() => {
    theme = resolveTheme(getStoredPref(), systemPrefersDark());
    // Keep "follow system" live while no explicit choice is set.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getStoredPref() === 'system') theme = applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setStoredPref(next);
    theme = applyTheme(next);
  }
</script>

<button
  type="button"
  onclick={toggle}
  class="rounded-full border border-white/20 p-1.5 text-on-chrome/90 hover:bg-white/10"
  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
>
  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
</button>
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ThemeToggle.svelte
git commit -m "feat(ui): sun/moon theme toggle"
```

---

## Task 7: VerdictPanel + VerdictPill restyle

**Files:**
- Create: `src/lib/components/VerdictPanel.svelte`
- Test: `tests/lib/components/VerdictPanel.test.ts`
- Modify: `src/lib/components/VerdictPill.svelte`

- [ ] **Step 1: Write the failing VerdictPanel test**

Create `tests/lib/components/VerdictPanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerdictPanel from '../../../src/lib/components/VerdictPanel.svelte';

describe('VerdictPanel', () => {
  it('renders the verdict word and reason', () => {
    const { getByText } = render(VerdictPanel, {
      props: { verdict: 'NO-GO', reason: 'Swell 6.2 ft over your 5 ft limit.' }
    });
    expect(getByText('NO-GO')).toBeTruthy();
    expect(getByText('Swell 6.2 ft over your 5 ft limit.')).toBeTruthy();
  });

  it('exposes the verdict via data attribute', () => {
    const { container } = render(VerdictPanel, { props: { verdict: 'GO', reason: 'clear' } });
    expect(container.querySelector('[data-verdict="GO"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/lib/components/VerdictPanel.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `src/lib/components/VerdictPanel.svelte`**

```svelte
<script lang="ts">
  import type { VerdictLabel } from '$lib/types.js';

  type Props = { verdict: VerdictLabel; reason: string };
  let { verdict, reason }: Props = $props();

  const VAR: Record<VerdictLabel, string> = {
    'GO': 'var(--v-go)',
    'CONDITIONAL': 'var(--v-cond)',
    'NO-GO': 'var(--v-nogo)',
    'INCOMPLETE': 'var(--v-inc)'
  };
</script>

<div
  data-verdict={verdict}
  class="verdict-panel"
  style={`--vc:${VAR[verdict]}`}
>
  <span class="word">{verdict}</span>
  <span class="reason">{reason}</span>
</div>

<style>
  .verdict-panel {
    border-radius: 10px;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--vc) 12%, var(--surface));
    box-shadow: inset 4px 0 0 var(--vc), 0 0 0 1px color-mix(in srgb, var(--vc) 30%, var(--line));
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .word {
    font-weight: 900;
    font-size: 30px;
    line-height: 1;
    letter-spacing: 0.01em;
    color: var(--vc);
  }
  /* Dawn glow — only in dark, and only when motion/contrast allow. */
  :global([data-theme='dark']) .word { text-shadow: 0 0 22px color-mix(in srgb, var(--vc) 55%, transparent); }
  .reason { font-size: 13px; color: var(--muted); }
  .word { font-size: clamp(24px, 7vw, 30px); }
</style>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/lib/components/VerdictPanel.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Restyle `VerdictPill.svelte` to tokens**

In `src/lib/components/VerdictPill.svelte`, the `classes` map already uses `bg-verdict-*` (now token-backed) with `text-white`. Change `text-white` → `text-on-accent` is wrong for verdict bg; keep white text on the saturated verdict fills, which is legible in both themes. **Only change needed:** none functionally — the `bg-verdict-*` classes now resolve to tokens automatically. Confirm by leaving the file as-is, OR (optional polish) reduce the large size since today now uses VerdictPanel. Apply this edit to drop the now-unused `lg` emphasis to a calmer pill:

Replace:
```svelte
  class={`inline-block rounded-full font-bold uppercase tracking-wide ${classes[verdict]} ${size === 'lg' ? 'px-6 py-2 text-2xl' : 'px-3 py-1 text-xs'}`}
```
with:
```svelte
  class={`inline-block rounded-full font-bold uppercase tracking-wide ${classes[verdict]} ${size === 'lg' ? 'px-4 py-1.5 text-lg' : 'px-3 py-1 text-xs'}`}
```

- [ ] **Step 6: Run the VerdictPill test**

Run: `npm test -- tests/lib/components/VerdictPill.test.ts`
Expected: PASS (text + `data-verdict` unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/VerdictPanel.svelte tests/lib/components/VerdictPanel.test.ts src/lib/components/VerdictPill.svelte
git commit -m "feat(ui): verdict status panel + token-based pill"
```

---

## Task 8: LayerTable restyle (status Icon + tokens)

**Files:**
- Modify: `src/lib/components/LayerTable.svelte`

- [ ] **Step 1: Swap the glyph maps for Icon + token classes**

In `src/lib/components/LayerTable.svelte`:

Add to the top of `<script>` (after the existing imports):
```ts
  import Icon from './Icon.svelte';
  import type { IconName } from './Icon.svelte';
```

Replace the `icon` and `iconClass` maps:
```ts
  const icon: Record<LayerStatus, string> = {
    pass: '✓', warn: '⚠', fail: '✗', incomplete: '?'
  };
  const iconClass: Record<LayerStatus, string> = {
    pass: 'text-green-600',
    warn: 'text-yellow-600',
    fail: 'text-red-600',
    incomplete: 'text-neutral-500'
  };
```
with:
```ts
  const iconName: Record<LayerStatus, IconName> = {
    pass: 'check', warn: 'warn', fail: 'x', incomplete: 'question'
  };
  const iconClass: Record<LayerStatus, string> = {
    pass: 'text-verdict-go',
    warn: 'text-verdict-conditional',
    fail: 'text-verdict-nogo',
    incomplete: 'text-verdict-incomplete'
  };
```

Replace the two helper functions `checkIcon`/`checkIconClass` bodies:
```ts
  function checkIconClass(status: Check['status']): string {
    return iconClass[status === 'unknown' ? 'incomplete' : status];
  }
  function checkIcon(status: Check['status']): string {
    return icon[status === 'unknown' ? 'incomplete' : status];
  }
```
with:
```ts
  function checkIconClass(status: Check['status']): string {
    return iconClass[status === 'unknown' ? 'incomplete' : status];
  }
  function checkIconName(status: Check['status']): IconName {
    return iconName[status === 'unknown' ? 'incomplete' : status];
  }
```

- [ ] **Step 2: Update the markup**

Replace the status cell:
```svelte
        <td class="py-3 pr-2 align-top w-10">
          <span class={`text-2xl ${iconClass[status]}`}>{icon[status]}</span>
        </td>
```
with:
```svelte
        <td class="py-3 pr-2 align-top w-10">
          <Icon name={iconName[status]} size={22} class={iconClass[status]} />
        </td>
```

Replace `<tr class="border-b border-neutral-200 last:border-0">` with `<tr class="border-b border-line last:border-0">`.
Replace the per-check icon `<span class={checkIconClass(c.status)}>{checkIcon(c.status)}</span>` with `<Icon name={checkIconName(c.status)} size={13} class={checkIconClass(c.status)} />`.
Apply the cheat-sheet to remaining classes in this file: `text-neutral-600` → `text-muted`, `text-neutral-700` → `text-muted`, `text-neutral-500` → `text-muted`.

- [ ] **Step 3: Run LayerTable tests + type-check**

Run: `npm test -- tests/lib/components/LayerTable.test.ts && npm run check`
Expected: PASS — the tests assert on `Legal/Safety/Quality/Logistics` + `rockfish open` text only, which is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/LayerTable.svelte
git commit -m "feat(ui): LayerTable status icons + tokens"
```

---

## Task 9: NowStrip restyle (Icon + tokens)

**Files:**
- Modify: `src/lib/components/NowStrip.svelte`

- [ ] **Step 1: Import Icon and replace the status-icon map**

In `src/lib/components/NowStrip.svelte`, add `import Icon from './Icon.svelte';` and `import type { IconName } from './Icon.svelte';` to the script.

Replace:
```ts
  const STATUS_ICON: Record<string, string> = { pass: '✓', warn: '⚠', fail: '✗', unknown: '?' };
```
with:
```ts
  const STATUS_ICON: Record<string, IconName> = { pass: 'check', warn: 'warn', fail: 'x', unknown: 'question' };
  const STATUS_CLASS: Record<string, string> = {
    pass: 'text-verdict-go', warn: 'text-verdict-conditional', fail: 'text-verdict-nogo', unknown: 'text-verdict-incomplete'
  };
```

- [ ] **Step 2: Update markup**

Replace the container `<section class="rounded border border-neutral-300 bg-neutral-50 p-3 text-sm" data-testid="now-strip">` with `<section class="rounded border border-line bg-surface2 p-3 text-sm" data-testid="now-strip">` (keep `data-testid`).

Replace the tide line:
```svelte
    <div class="mt-1 text-xs text-sky-700">🌊 {now.tideContext}</div>
```
with:
```svelte
    <div class="mt-1 flex items-center gap-1 text-xs text-accent"><Icon name="tide" size={13} /> {now.tideContext}</div>
```

Replace the factor icon span:
```svelte
          <span aria-hidden="true">{STATUS_ICON[f.status] ?? '?'}</span><span class="sr-only">{f.status}:</span> {f.name}: {f.value}{f.note ? ` — ${f.note}` : ''}
```
with:
```svelte
          <Icon name={STATUS_ICON[f.status] ?? 'question'} size={12} class={STATUS_CLASS[f.status] ?? 'text-verdict-incomplete'} /><span class="sr-only">{f.status}:</span> {f.name}: {f.value}{f.note ? ` — ${f.note}` : ''}
```

Replace the bailout block class `border-yellow-300 bg-yellow-50 ... text-yellow-900` with `class="callout-caution mt-2 rounded p-2 text-xs"` (drop the old color utilities, keep layout utilities). Apply the cheat-sheet to remaining `text-neutral-*` / `border-neutral-*` in this file. Keep `text-amber-700` (degraded staleness) as `text-verdict-conditional`.

- [ ] **Step 3: Run NowStrip tests + type-check**

Run: `npm test -- tests/lib/components/NowStrip.test.ts && npm run check`
Expected: PASS — tests assert on text regexes only (unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/NowStrip.svelte
git commit -m "feat(ui): NowStrip icons + tokens"
```

---

## Task 10: DayCard restyle (cards, VerdictPanel, window dots, emoji→Icon) + test update

**Files:**
- Modify: `src/lib/components/DayCard.svelte`
- Modify: `tests/lib/components/DayCard.test.ts`

- [ ] **Step 1: Update the window-state assertions in `DayCard.test.ts`**

The markers become decorative CSS dots, so `data-testid="window-state"` text content drops the glyph. In `tests/lib/components/DayCard.test.ts`:

Replace `expect(badges).toEqual(['▪ past', '○ upcoming']);` with `expect(badges).toEqual(['past', 'upcoming']);`
Replace `...).toEqual(['▪ past', '○ upcoming']);` (line ~159) with `...).toEqual(['past', 'upcoming']);`
Replace `...).toEqual(['▪ past', '● active now']);` (line ~161) with `...).toEqual(['past', 'active now']);`

- [ ] **Step 2: Run the test to confirm it now FAILS against current code**

Run: `npm test -- tests/lib/components/DayCard.test.ts`
Expected: FAIL — current DayCard still renders `▪ past` etc. (This is the failing-test step; the markup change in Step 3 makes it pass.)

- [ ] **Step 3: Update DayCard script + markup**

In `src/lib/components/DayCard.svelte` script, add:
```ts
  import Icon from './Icon.svelte';
  import VerdictPanel from './VerdictPanel.svelte';
```

Change the window-state badge map to label-only (drop the glyph; the dot is CSS):
```ts
  const STATE_BADGE = { past: ['▪', 'past'], active: ['●', 'active now'], upcoming: ['○', 'upcoming'] } as const;
```
becomes:
```ts
  const STATE_BADGE = { past: 'past', active: 'active now', upcoming: 'upcoming' } as const;
```
and update `badgeFor` return type/usage to a string:
```ts
  function badgeFor(w: LaunchWindow): string | null {
    if (mode !== 'today' || nowMs === undefined) return null;
    const s = windowState(nowMs, w);
    return s ? STATE_BADGE[s] : null;
  }
```

Card container: replace
```svelte
  class={`rounded-lg border border-neutral-200 bg-white ${mode === 'today' ? 'p-4 shadow-sm' : 'p-3'} ${lowConfidence ? 'opacity-60' : ''}`}
```
with
```svelte
  class={`rounded-lg border border-line bg-surface ${mode === 'today' ? 'p-4 shadow-sm' : 'p-3'} ${lowConfidence ? 'opacity-60' : ''}`}
```

Today verdict — insert the panel. For `mode === 'today'`, render `VerdictPanel` below the header button. Inside the header button, keep the small `VerdictPill` for row mode only; for today, show just the date in the button and let the panel carry the verdict. Concretely, change the header `<span>` block:
```svelte
      <VerdictPill verdict={verdict.verdict} size={mode === 'today' ? 'lg' : 'sm'} />
```
to:
```svelte
      {#if mode !== 'today'}<VerdictPill verdict={verdict.verdict} size="sm" />{/if}
```
and immediately after the closing `</button>` of the header, add:
```svelte
  {#if mode === 'today'}
    <div class="mt-3"><VerdictPanel verdict={verdict.verdict} reason={verdict.reason} /></div>
  {/if}
```
(The truncated `{verdict.reason}` span in the header stays for row mode; for today the panel shows the reason. To avoid duplication on today, wrap that reason span in `{#if mode !== 'today'}…{/if}`.)

Window-state badge markup: replace each
```svelte
                {#if badge}
                  <span class="ml-2 text-xs text-neutral-500" data-testid="window-state"><span aria-hidden="true">{badge[0]}</span> {badge[1]}</span>
                {/if}
```
with
```svelte
                {#if badge}
                  <span class="ml-2 inline-flex items-center gap-1 text-xs text-muted" data-testid="window-state"><span class="window-dot" aria-hidden="true"></span>{badge}</span>
                {/if}
```
(There are two occurrences — live windows and suppressed windows. Update both; the suppressed one keeps its surrounding markup.)

Emoji swaps in DayCard:
- Tide: `<div class="mt-1 text-xs text-sky-700">🌊 {w.tide.description}</div>` → `<div class="mt-1 flex items-center gap-1 text-xs text-accent"><Icon name="tide" size={13} /> {w.tide.description}</div>`
- Window warning: `⚠ {w.warning}` block → wrap class to `callout-caution` and replace the `⚠` with `<Icon name="warn" size={13} class="inline" />`. Specifically replace `<div class="mt-1 inline-block rounded border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-900">⚠ {w.warning}</div>` with `<div class="callout-caution mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"><Icon name="warn" size={12} /> {w.warning}</div>`
- Copy button label: `{copiedLabel === w.label ? '✓ Copied' : '📋 Copy shore msg'}` → `{#if copiedLabel === w.label}<Icon name="check" size={13} class="inline" /> Copied{:else}<Icon name="copy" size={13} class="inline" /> Copy shore msg{/if}` (button class: change `border-neutral-300 bg-white ... hover:bg-neutral-100` → `border-line bg-surface ... hover:bg-surface2`).
- Suppressed reason: `<span aria-hidden="true">⛔</span> <span>{w.suppressedReason}</span>` → `<Icon name="block" size={13} class="inline text-verdict-nogo" /> <span>{w.suppressedReason}</span>`
- Bailout block: `border-yellow-300 bg-yellow-50 ... text-sm` → `class="callout-caution mt-2 rounded p-3 text-sm"`.
- Tidal-currents block: `border-sky-300 bg-sky-50 ... text-sm` (keep `data-testid="tidal-currents-block"`) → `class="callout-info mt-2 rounded p-3 text-sm"`.
- "Verify within 2 hours" block: `border-neutral-300 bg-neutral-50 ... text-neutral-700` → `class="mt-3 rounded border border-line bg-surface2 p-3 text-xs text-muted"`.
- Recommended-windows box `bg-neutral-50` → `bg-surface2`; section labels `text-neutral-500` → `text-muted`.

Add the window-dot style at the end of the file:
```svelte
<style>
  .window-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
</style>
```

Apply the cheat-sheet to any remaining `text-neutral-*` / `bg-neutral-*` / `border-neutral-*` in this file.

- [ ] **Step 4: Run the DayCard test to confirm it passes**

Run: `npm test -- tests/lib/components/DayCard.test.ts && npm run check`
Expected: PASS — window-state now reads `past`/`upcoming`/`active now`; all other assertions (source-chip, suppressed-window, now-strip, tidal-currents-block, text) unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/DayCard.svelte tests/lib/components/DayCard.test.ts
git commit -m "feat(ui): DayCard status panel, window dots, icons, tokens"
```

---

## Task 11: CatchRulesCard + RegRow + VerifyBadge restyle

**Files:**
- Modify: `src/lib/components/VerifyBadge.svelte`
- Modify: `src/lib/components/RegRow.svelte`
- Modify: `src/lib/components/CatchRulesCard.svelte`

- [ ] **Step 1: VerifyBadge — warn Icon + external Icon + tokens**

Replace the body of `src/lib/components/VerifyBadge.svelte` (keep script unchanged):
```svelte
{#if confidence !== 'confirmed'}
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-800"
  >
    ⚠ Verify{confidence === 'historical' ? ' (historical)' : ''} ↗
  </a>
{/if}
```
with:
```svelte
<script lang="ts">
  import type { Confidence } from '$lib/config/regs.js';
  import Icon from './Icon.svelte';
  type Props = { confidence: Confidence; sourceUrl: string };
  let { confidence, sourceUrl }: Props = $props();
</script>

{#if confidence !== 'confirmed'}
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="callout-caution ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-medium"
  >
    <Icon name="warn" size={11} /> Verify{confidence === 'historical' ? ' (historical)' : ''} <Icon name="external" size={10} />
  </a>
{/if}
```
(Replace the whole file — the original `<script>` had no Icon import.)

- [ ] **Step 2: RegRow — tokens**

In `src/lib/components/RegRow.svelte`, apply the cheat-sheet: `text-neutral-500` → `text-muted`, `text-neutral-900` → `text-ink`, the inner `text-neutral-500` note → `text-muted`.

- [ ] **Step 3: CatchRulesCard — warn Icon + tokens**

In `src/lib/components/CatchRulesCard.svelte`, add `import Icon from './Icon.svelte';` to the script.

Replace `<h3 class="text-sm font-semibold text-amber-900">⚠ {idGuide.title}</h3>` with:
```svelte
        <h3 class="flex items-center gap-1 text-sm font-semibold"><Icon name="warn" size={14} class="text-verdict-conditional" /> {idGuide.title}</h3>
```
Apply the cheat-sheet to the rest:
- compact `details`: `border-neutral-300 bg-neutral-50 text-neutral-700` → `border-line bg-surface2 text-muted`
- full `section`: `border-neutral-300 bg-white` → `border-line bg-surface`; `text-neutral-900` → `text-ink`; `divide-neutral-100` → `divide-line`
- season badge: keep semantic — `bg-emerald-100 text-emerald-800` → `class="callout-info ..."` is wrong (it's a success state); instead map OPEN → `text-verdict-go` on a `bg-surface2` pill, CLOSED → `text-verdict-nogo` on `bg-surface2`. Replace the badge span class expression with:
  ```svelte
        <span class={`rounded-full px-2 py-0.5 text-xs font-medium bg-surface2 ${seasonOpen ? 'text-verdict-go' : 'text-verdict-nogo'}`}>
  ```
- idGuide wrapper `border-amber-300 bg-amber-50` → `class="callout-caution mt-4 rounded-md p-3"`; inner candidate cards `border-amber-200 bg-white` → `border-line bg-surface`; `text-neutral-*` → `text-ink`/`text-muted` per cheat-sheet; the `bg-neutral-100 text-neutral-600` origin chip → `bg-surface2 text-muted`.
- footer `text-neutral-500` → `text-muted`. Leave the `↗` text arrows in plain links as-is (low priority) OR optionally swap for `<Icon name="external" size={10} />` — not required.

- [ ] **Step 4: Run the related tests + type-check**

Run: `npm test -- tests/lib/components/CatchRulesCard.test.ts tests/lib/components/RegRow.test.ts tests/lib/components/VerifyBadge.test.ts && npm run check`
Expected: PASS — these tests assert on text/labels (`SIZE`, `KEEP`, values, "Verify"), which are preserved. If any asserts on the literal `⚠`/`bg-amber-*`, update that assertion to match the new markup (none expected per current grep).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/VerifyBadge.svelte src/lib/components/RegRow.svelte src/lib/components/CatchRulesCard.svelte
git commit -m "feat(ui): catch-rules card/row/badge icons + tokens"
```

---

## Task 12: Layout + page + rules route restyle

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/rules/+page.svelte`

- [ ] **Step 1: `+layout.svelte` — global background**

Read the current `src/routes/+layout.svelte`. Ensure the app root uses `bg-bg text-ink` (the html already gets these via `app.css`, but if the layout wraps content in a container, give it `min-h-screen bg-bg text-ink`). If the layout is a bare `<slot />`/`{@render children()}`, wrap once:
```svelte
<div class="min-h-screen bg-bg text-ink">
  {@render children()}
</div>
```
(Match the file's existing Svelte 5 children/slot pattern.)

- [ ] **Step 2: `+page.svelte` — header wordmark, tabs, ThemeToggle, refresh Icon, callouts**

In `src/routes/+page.svelte` script add:
```ts
  import Icon from '$lib/components/Icon.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
```

Header: replace the sticky `<header ...>` opening tag classes `bg-white/95 ... border-neutral-200` with `bg-chrome text-on-chrome ... border-line`. Inside the header, prepend a wordmark lockup as the first child:
```svelte
    <a href="/" class="flex items-center gap-2 font-extrabold tracking-tight text-on-chrome" data-sveltekit-preload-data="hover">
      <img src="/logo.svg" alt="" class="h-6 w-6 rounded" />
      <span>humboldt<span class="text-accent">.fish</span></span>
    </a>
```
Restyle the species pill bar: container `bg-neutral-100` → `bg-black/20`; active pill `bg-white shadow font-semibold` → `bg-accent text-on-accent font-semibold`; inactive `text-neutral-600` → `text-on-chrome/70`.
Restyle the launch `<select>` and Rules `<a>`: `bg-neutral-100 border-neutral-200 text-neutral-700` → `bg-black/20 border-line text-on-chrome`.
Add the `ThemeToggle` just before the refresh button (so it sits at `ml-auto`): move `ml-auto` onto a wrapper holding both:
```svelte
    <div class="ml-auto flex items-center gap-1">
      <ThemeToggle />
      <button type="button" class="rounded-full bg-black/20 px-3 py-1 text-sm text-on-chrome" onclick={refresh} disabled={refreshing} aria-label="Refresh">
        {#if refreshing}…{:else}<Icon name="refresh" size={16} />{/if}
      </button>
    </div>
```
(remove the old standalone refresh button).

Safety banner: replace the `<aside class="... border-red-300 bg-red-50 ... text-red-800">` classes with `class="callout-danger mb-3 rounded p-3 text-xs leading-snug"` (keep all inner text + `tel:` links verbatim).
Error box: `border-red-300 bg-red-50 text-red-800` → `callout-danger`.
Rolled-over notice: `border-amber-300 bg-amber-50 text-amber-900` → `callout-caution`.
Footer: `border-neutral-200 text-neutral-500` → `border-line text-muted`; stale `text-red-600` → `text-verdict-nogo`; the freshness intro line may get a leading `<Icon name="info" size={12} />`. "Next days" heading `text-neutral-500` → `text-muted`.

- [ ] **Step 3: `rules/+page.svelte` — tokens**

Apply the cheat-sheet: header `← Verdict` link and the launch `<select>` + species pills mirror the `+page.svelte` treatment (`bg-surface2`/`border-line`/`text-muted`; active pill `bg-accent text-on-accent`). The page background comes from the layout. Keep all text + links.

- [ ] **Step 4: Full regression — check, test, build**

Run: `npm run check && npm test && npm run build`
Expected: ALL PASS. `npm test` runs the full 240+ suite; only `theme`, `Icon`, `VerdictPanel`, and `DayCard` test files changed, all green.

- [ ] **Step 5: Manual visual verification (both themes)**

Per CLAUDE.md, **do not** start the dev server from a tool. Ask the user to run in a fresh terminal:
```
npm run dev:clean
```
Then verify at `http://localhost:5173`:
- Light + dark both render; toggle (sun/moon) flips and persists across reload.
- Today card shows the verdict status panel; next-days rows show small pills.
- No emoji anywhere; all icons render (check/x/warn/tide/copy/block/refresh/sun/moon/info).
- Safety banner is red and legible in both themes; `/rules` route styled and works offline (DevTools → offline → reload).
- WCAG AA contrast spot-check on muted text + verdict colors in both themes.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+layout.svelte src/routes/+page.svelte src/routes/rules/+page.svelte
git commit -m "feat(ui): header wordmark, theme toggle, callouts across routes"
```

---

## Self-review notes (author)

- **Spec coverage:** tokens+Tailwind (T1), fonts self-hosted+precache (T2), theme resolve/persist (T3), no-flash bootstrap+theme-color (T4), icon set/emoji retirement (T5), theme toggle (T6), verdict status panel + pill (T7), LayerTable (T8), NowStrip (T9), DayCard incl. window dots (T10), catch-rules trio (T11), layout/page/rules + a11y + offline verify (T12). All spec sections map to a task.
- **Guardrails:** no task edits `verdict/`, `fetchers/`, `config/`, `server/`, `reference/`, `api/`, or `+page.server.ts`. Confirmed only `DayCard.test.ts` couples to glyphs; updated there and nowhere else.
- **Type consistency:** `IconName` exported from `Icon.svelte` and imported by LayerTable/NowStrip; `iconName`/`checkIconName` names consistent within LayerTable; `resolveTheme`/`getStoredPref`/`setStoredPref`/`applyTheme`/`systemPrefersDark` names consistent across `theme.ts`, its test, `ThemeToggle`, and the `app.html` bootstrap (bootstrap re-implements inline by necessity, mirroring the same `hf-theme` key + chrome hexes).
- **Known follow-up:** redrawn logo mark is out of scope (uses existing `logo.svg`).
