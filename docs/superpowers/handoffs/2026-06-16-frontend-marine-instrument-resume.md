# Resume handoff — Marine Instrument frontend enhancement

**Written:** 2026-06-16, mid-implementation, ahead of a repo directory move.

## One-line status

Design + plan approved and committed; executing the 12-task plan via **subagent-driven-development**. **Tasks 1–3 done and committed. Resume at Task 4.**

## Branch

`feat/frontend-marine-instrument` (off `main`). All work is committed here — nothing important is uncommitted. The move carries everything via git.

## The artifacts (committed, travel with the repo)

- **Spec:** `docs/superpowers/specs/2026-06-16-frontend-marine-instrument-design.md`
- **Plan (the source of truth for execution):** `docs/superpowers/plans/2026-06-16-frontend-marine-instrument.md` — 12 tasks, each with exact code + verification commands.
- This handoff.

## What's done

| Task | What | Commit | Review status |
|---|---|---|---|
| 1 | Design tokens (CSS vars, light/dark) + theme-aware Tailwind colors + `.callout-*` classes | `95eb5be` | spec ✅ + code-quality ✅ |
| 2 | Self-host Inter (variable, latin) + IBM Plex Mono (latin 400/500/600) via `@fontsource`; inline `@font-face`; PWA-precached | `3ba3af0` | spec ✅ + code-quality ✅ |
| 3 | `src/lib/theme.ts` (resolve/persist/apply) + `tests/lib/theme.test.ts` (TDD) | `8f8502b` | controller-accepted (verbatim plan code + TDD red→green; optional re-review) |

Full suite: **359/359 passing**. `pnpm run check` clean (pre-existing `state_referenced_locally` warning in `DayCard.svelte` is unrelated).

## What's left — resume here

- **Task 4:** `src/app.html` no-flash theme bootstrap + theme-color meta.
- **Task 5:** `Icon.svelte` (inline-SVG set, retires emoji) + test.
- **Task 6:** `ThemeToggle.svelte` (sun/moon).
- **Task 7:** `VerdictPanel.svelte` (today status panel) + test; `VerdictPill` restyle.
- **Task 8:** `LayerTable` icons + tokens.
- **Task 9:** `NowStrip` icons + tokens.
- **Task 10:** `DayCard` status panel, window dots, icons, tokens + `DayCard.test.ts` window-state assertion update (`▪ past` → `past`, etc.).
- **Task 11:** `CatchRulesCard` + `RegRow` + `VerifyBadge` icons + tokens.
- **Task 12:** `+layout.svelte` wordmark + ThemeToggle, `+page.svelte`, `rules/+page.svelte`, callouts; then full `check`+`test`+`build` + manual both-theme verify.

After all tasks: a final whole-branch code review, then `superpowers:finishing-a-development-branch`.

## CRITICAL toolchain gotcha (must replicate in the new dir)

- The repo pins **Node 24** with `engine-strict=true`, but the machine's default `node` is v26 (Homebrew) which **fails every install/test/build**. nvm has v24.16.0. **Prefix every node/pnpm command:**
  ```
  export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
  ```
- The repo uses **pnpm** (not npm): `pnpm run check`, `pnpm test`, `pnpm run build`, `pnpm add`.
- (If nvm's node-24 patch version differs after the move, adjust the path; `ls $HOME/.nvm/versions/node/` to find it.)

## Execution method (for the resuming session)

Subagent-driven-development (skill `superpowers:subagent-driven-development`): per task, dispatch one implementer subagent with the FULL task text pasted in (don't make it read the plan), then spec-compliance review, then code-quality review; fix loops until both pass; commit per task. Prompt templates are in that skill's directory (`implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md`). Use Node-24 prefix + pnpm in every dispatch. Keep edits within scope: **never touch** `src/lib/verdict/`, `fetchers/`, `config/`, `server/`, `reference/`, `src/routes/api/`, or `+page.server.ts`.

## Resume procedure after the move

1. Move the **whole** directory (keep `.git`, `node_modules`, `.svelte-kit`). pnpm uses a virtual store (`node_modules/.pnpm`); a same-machine move is safe, but run `pnpm install` to be sure.
2. In the new dir:
   ```
   export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
   node -v          # expect v24.x
   pnpm install     # relink after move
   pnpm test        # expect ~359 passing
   git branch --show-current   # expect feat/frontend-marine-instrument
   ```
3. Open Claude Code in the new dir and say: *"Resume the Marine Instrument frontend build from `docs/superpowers/handoffs/2026-06-16-frontend-marine-instrument-resume.md` — continue subagent-driven from Task 4."*

## Notes

- Auto-memory is keyed to the **old** project path and will NOT carry to a new directory — this committed handoff (in the repo) is the reliable resume record, not memory.
- The brainstorm visual-companion mockups lived in `.superpowers/` (gitignored, ephemeral); not needed to resume. The local mockup server was stopped at pause.
