# Contributing

## The reference/ ↔ src/lib/config/ sync rule

`reference/` is the canonical source of truth for thresholds, launches, regulations, and data sources. `src/lib/config/` files mirror those numbers and rules as TypeScript so the runtime can apply them.

When you change a file in `reference/`, update the corresponding file in `src/lib/config/` in the **same commit**:

| reference file | mirror in code |
|---|---|
| `reference/thresholds.md` | `src/lib/config/thresholds.ts` |
| `reference/launches.md` | `src/lib/config/launches.ts` |
| `reference/regs/rockfish-lingcod-*.md` | `src/lib/config/regs.ts` (rockfish, lingcod entries) |
| `reference/regs/salmon-*.md` | `src/lib/config/regs.ts` (salmon entry) |
| `reference/data-sources.md` | `src/lib/config/sources.ts` |

If you forget, the corresponding test should catch it (each `src/lib/config/*.ts` has unit tests that pin specific numbers). When the test fails, fix the mirror and re-run.

## NOAA endpoint drift

If `npm run smoke` fails for any source, an endpoint shape has changed. Update the Zod schema or parser in the relevant `src/lib/fetchers/*.ts`, save a new fixture in `tests/fixtures/`, and re-run unit tests.

The NWS marine forecast API has already pivoted once (the structured `/zones/forecast/PZZxxx/forecast` endpoint was deprecated in early 2026 in favor of the CWF text product). Don't be surprised when it happens again.

## Tests

- `npm test` — must pass before any commit
- `npm run smoke` — run before deploys to catch live-endpoint drift
