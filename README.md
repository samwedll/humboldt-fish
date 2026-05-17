# humboldt.fish

A mobile-first website that renders a four-layer go/no-go verdict for kayak fishing in Humboldt County, CA. Pulls live NOAA marine data through a Cloudflare Pages Function and applies a specific set of personal thresholds documented in `reference/`. **Not a general-purpose tool — see [DISCLAIMER.md](./DISCLAIMER.md).**

**Live:** https://humboldt.fish

## Local development

```bash
npm install
npm run dev           # http://localhost:5173
npm test              # unit + schema tests
npm run smoke         # live-NOAA endpoint smoke test (not in CI)
npm run build         # Cloudflare Pages production build
```

## Architecture

- SvelteKit + TypeScript (Svelte 5 runes) with `@sveltejs/adapter-cloudflare`
- Pure verdict module in `src/lib/verdict/` — fully unit-tested
- Per-source NOAA fetchers in `src/lib/fetchers/` with Zod schemas
- NWS marine zone forecasts come from the CWF text product (the structured marine API was deprecated mid-2026); see `src/lib/fetchers/nws-zone.ts` and the prose parser in `src/lib/verdict/parseMarineProse.ts`
- Edge-cached responses via Cloudflare Cache API, per-source TTLs in `src/lib/config/sources.ts`
- Threshold numbers and regulations in `src/lib/config/` mirror canonical docs in `reference/`

See `docs/superpowers/specs/2026-05-17-humboldt-fishing-web-v1-design.md` for the full design rationale and `docs/superpowers/plans/2026-05-17-humboldt-fishing-web-v1.md` for the implementation plan.

## Conventions

- `reference/` is the canonical source of truth for thresholds, launches, regs, and data sources. Read-only inside Claude Code sessions. Updates happen in Claude.ai chat and get copied back.
- `src/lib/config/*.ts` mirrors `reference/`. When a reference file changes, sync the TS file in the same commit. See `CONTRIBUTING.md`.
- Conservative defaults are not negotiable in-conversation. If a threshold says ≤5 ft, the verdict is NO-GO at 5.1 ft.
