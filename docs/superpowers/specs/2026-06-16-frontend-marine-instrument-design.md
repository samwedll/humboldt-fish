# Frontend enhancement — "Marine Instrument, dark-first"

- **Date:** 2026-06-16
- **Status:** Design approved in brainstorm; pending spec review → implementation plan
- **Scope class:** Visual layer only (design system + look). No product/logic changes.

## Goal

Replace the current generic, unstyled look of humboldt.fish (system font, pure grays, emoji icons, verdict color as the only personality) with a distinctive, production-grade design system — without touching the proven information architecture, decision logic, thresholds, data layer, or safety copy.

The app's real usage moment drives the design: opened at ~0500, on a phone, one-handed, often in marginal dawn light, to make a **safety-critical** go/no-go call. The design must be glanceable in low light and legible in bright outdoor sun.

## Locked decisions (from brainstorm)

1. **Scope** — Design system + look. Keep IA, layout, routes, and the four-layer verdict logic. New: typography, color/brand identity, icon set, depth/hierarchy, refined verdict + card treatment.
2. **Brand** — Evolve the existing seed (the `static/logo.svg` fish mark + deep-ocean-blue `#0c4a6e` theme color). No new external assets; grow the seed into a full system.
3. **Direction** — "Marine Instrument, dark-first": precise, data-forward, NOAA-grade chrome (Inter + mono numerals, hairline rules, status-light verdict), grafted with a **dark "dawn" theme as the hero** and a **bigger, bolder verdict**.
4. **Theme** — Auto by system preference (`prefers-color-scheme`), with a **sun/moon manual override** in the header, persisted per device. Dark "dawn" is the hero; light "day" is the bright-light/daytime mode.
5. **Fonts** — Self-hosted **subset woff2** for Inter (UI) + IBM Plex Mono (data). Precached by the service worker for offline use. No third-party request, no layout shift. ~30–60KB total.

## Design system

### Color tokens

Defined as CSS custom properties on `:root` (day) and `[data-theme="dark"]` (dawn). Tailwind colors reference the variables so existing utility usage remaps without per-element rewrites where possible. Semantic names, not raw hues.

**Light "day"**
| token | value | role |
|---|---|---|
| `--bg` | `#eef3f7` | page background (cool white) |
| `--surface` | `#ffffff` | cards |
| `--chrome` | `#0b2b40` | header / nav bar (deep navy) |
| `--border` | `#dde8f0` | hairline rules, card borders |
| `--text` | `#16242e` | primary text |
| `--muted` | `#5a7286` | secondary text / labels |
| `--accent` | `#0ea5e9` | interactive / active tab / links |

**Dark "dawn" (hero)**
| token | value | role |
|---|---|---|
| `--bg` | `#081420` | page background (ink) |
| `--surface` | `#0d1f2e` | cards |
| `--chrome` | `#040c13` | header / nav bar |
| `--border` | `#173143` | hairline rules, card borders |
| `--text` | `#e7f0f7` | primary text (foam) |
| `--muted` | `#7e9bb0` | secondary text / labels |
| `--accent` | `#38bdf8` | interactive / active tab / links |

**Verdict colors (semantic, tuned per theme)** — the brighter dawn variants keep AA contrast on the dark `--surface`.
| verdict | day | dawn |
|---|---|---|
| GO | `#16a34a` | `#2fd07a` |
| CONDITIONAL | `#ca8a04` | `#f5b942` |
| NO-GO | `#dc2626` | `#ff5a5a` |
| INCOMPLETE | `#64748b` | `#9fb2c0` |

These supersede the current flat `tailwind.config.js` `verdict.*` colors, which become theme-aware tokens.

### Typography

- **Inter** — UI and headings. Weights 400/500/600/700/800/900.
- **IBM Plex Mono** — all numeric/data values (swell, period, times, source line), `font-variant-numeric: tabular-nums`. Weights 400/500/600.
- Type scale:
  - Wordmark: Inter 800, ~22px, letter-spacing −0.015em
  - Verdict word: Inter 900, ~30px, line-height 1
  - Section label: 10px, uppercase, letter-spacing 0.14em, weight 700, `--muted`
  - Body: Inter 400, 14px
  - Data: Plex Mono 500, 11–13px, tabular

### Iconography

A small inline-SVG icon set (`currentColor`, `aria-hidden`, paired with text/sr-only labels exactly as today) replaces **every** emoji and text glyph:

| icon | replaces | usage |
|---|---|---|
| check | `✓` | layer pass, checklist |
| x | `✗` | layer fail |
| warn | `⚠` | layer warn, warnings, bailout |
| question | `?` | unknown status |
| tide (wave) | `🌊` | tide context lines |
| copy (clipboard) | `📋` | "copy shore msg" button |
| block (no-entry) | `⛔` | suppressed-window reason |
| refresh | `↻` | refresh button |
| sun / moon | (new) | theme toggle |
| info | (new) | data-source / freshness footer |

Window-state markers (`● ○ ▪` active/upcoming/past) become small SVG/CSS dots; their text labels ("active now"/"upcoming"/"past") are unchanged.

### Depth & layout language

- Cards: `--surface` with 1px `--border`, modest radius (~7–10px — instrument, not pillowy), a subtle shadow on light / inset hairline on dark.
- Hairline rules between layer rows (chart-graticule feel).
- Section labels in small caps with tracking.
- **Verdict status panel** (the hero treatment): the verdict word (Inter 900, ~30px) sits in a tinted recessed panel with a color-coded 4px left rule and, on dark, a soft text glow in the verdict color; the one-line reason sits beneath. Glanceable at arm's length, still instrument-grade (not a full-bleed slab).

## Theme system mechanics

- `data-theme` attribute on `<html>` (`"dark"` / `"light"`); absence = follow system.
- Resolution order: explicit localStorage choice → `prefers-color-scheme` → default.
- **No-flash bootstrap**: a tiny inline script in `src/app.html` sets the attribute before first paint.
- Sun/moon toggle (header) cycles/sets the choice, writes localStorage, updates the `<meta name="theme-color">` to match the active theme's `--chrome`.
- A `matchMedia('(prefers-color-scheme: dark)')` listener keeps "follow system" live when no explicit choice is set.
- Logic lives in a small `src/lib/theme.ts` (get / set / toggle / subscribe). The toggle component reads/writes through it.

## Component-by-component changes

All are presentation-only. No props that carry decision data change meaning; all `data-testid` and aria/sr-only hooks are preserved.

- **`tailwind.config.js`** — replace flat `verdict.*` with token-backed colors; add semantic color tokens mapped to CSS vars; register font families.
- **`src/app.css`** — define `:root` and `[data-theme="dark"]` token blocks; `@font-face` for the self-hosted subsets; base element styling via tokens.
- **`src/app.html`** — no-flash theme bootstrap script; theme-color meta managed by theme.
- **`src/routes/+layout.svelte`** — wordmark lockup (fish + `humboldt.fish`); species pills / launch select / Rules link restyled as instrument tabs; new sun/moon toggle; red "Not for general use" banner and footer restyled to tokens with **content/links verbatim**.
- **`src/lib/components/Icon.svelte`** (new) — the inline-SVG set; takes a name + optional size/class.
- **`src/lib/theme.ts`** (new) — theme state/persistence util.
- **`VerdictPill.svelte`** — token-based verdict colors. Today's verdict renders as the new status panel; the next-days rows keep the restyled small pill. Both pull the same verdict tokens.
- **`DayCard.svelte`** — instrument card styling, status panel for today's verdict, mono data values, caps labels, emoji→`Icon`. No logic change (window suppression, source chip, bailout, gear, salmon hotline, "verify within 2 hours" block all behave identically).
- **`NowStrip.svelte`** — restyle to match; status icons via `Icon`; mono data; tokens.
- **`LayerTable.svelte`** — row = icon + label + mono value, hairline rules, tokens.
- **`CatchRulesCard.svelte` / `RegRow.svelte` / `VerifyBadge.svelte`** — token/type restyle; `VerifyBadge` keeps its meaning and link.
- **`src/routes/rules/+page.svelte`** — inherits the system; remains prerendered + precached. Self-hosted fonts added to the precache manifest so `/rules` stays fully styled offline.

## Non-goals / guardrails

- **Zero changes** to `src/lib/verdict/*`, `src/lib/fetchers/*`, `src/lib/config/*`, `reference/*`, `src/routes/api/verdict/+server.ts`, `src/routes/+page.server.ts`.
- No threshold, decision-logic, or data change. Conservative defaults remain binding.
- All verdict text, reasons, the "Verify the bar status and salmon hotline within 2 hours of launch…" footer, and all hotline numbers/`tel:` links — verbatim.
- IA and layout unchanged: header → today card → next-days rows → freshness footer; same expand/collapse; same `/rules` route and PWA behavior.
- Mobile-first; no new navigation or views.

## Accessibility

- WCAG AA contrast for text and verdict colors against their backgrounds in **both** themes (dawn verdict variants chosen for this).
- Icons remain decorative (`aria-hidden`) with the existing visible text or `sr-only` labels carrying meaning (e.g., suppressed-window `sr-only "Unavailable —"`, layer status `sr-only` text).
- Theme toggle is a labeled button (`aria-label`, reflects current state).
- Respect `prefers-reduced-motion` for the verdict glow/any transitions.

## Testing impact

- The verdict / fetcher / config / `evaluateNow` / `windowState` suites are **untouched** (we don't edit that code) and must stay green.
- Component/DOM tests that assert on emoji characters (`🌊 ⚠ ✓ ✗ ↻ 📋 ⛔`) or on the old color classes get updated **in the same change** to the new `Icon` markup / token classes, while all `data-testid` and text-content assertions remain satisfied.
- Add focused tests for `theme.ts` (resolution order, persistence, system fallback) and that `Icon` renders the expected symbol per name.
- `npm run check` (svelte-check) and `npm test` must pass; `npm run build` (Cloudflare adapter + PWA) must succeed with fonts in the precache manifest.

## Fonts — self-hosted subset detail

- Subset Inter + IBM Plex Mono to the Latin glyphs + the digits/punctuation actually used; ship woff2 only.
- Store under `static/fonts/` (or `src/lib/assets/`), reference via `@font-face` with `font-display: swap` and a system fallback that minimizes metric shift.
- Ensure the woff2 files are included in the `@vite-pwa/sveltekit` precache so the installed PWA and `/rules` render fully offline.
- Keep total added weight in the ~30–60KB range; document the subsetting step so fonts can be regenerated.

## Known gaps / future (out of scope here)

- Logo mark refinement (the fish is kept as-is for now; a redrawn mark is a separate, optional follow-up).
- Any animation beyond a subtle verdict-glow / theme-transition.
- No changes to the Phase-3 MCP-server plan.

## Reference

Approved mockups were produced in the brainstorming visual companion (`.superpowers/brainstorm/`, gitignored/ephemeral): the current-state audit, three directions, the A+C synthesis (dark+light), and this design system's style tile. The tokens and decisions above are the durable record.
