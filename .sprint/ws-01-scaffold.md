# WS1 — Scaffold, guardrails, CI

## Scope
SvelteKit app at the repo root, plus every check that later chunks rely on. This chunk sets the patterns agents will copy, so keep it clean and minimal.

- SvelteKit (Svelte 5 runes), TypeScript strict, `@sveltejs/adapter-vercel`, pnpm. Node version pinned in `package.json` `engines` and `.nvmrc`.
- Directories:
  - `src/lib/domain/`: pure TS (schemas, calculators). No Svelte, no browser APIs.
  - `src/lib/features/<feature>/`: today, week, log, progress. UI plus feature logic.
  - `src/lib/ui/`: shared primitives (Button, Row, Disclosure, TabBar, tokens.css).
  - `src/lib/server/`: DB and sync, server only.
  - `src/routes/`: thin; composes features.
- Lint (ESLint flat config + eslint-plugin-svelte + typescript-eslint). Each rule's message names the fix.
  - Import boundaries:
    - `domain` imports nothing from `features`, `ui`, `server` or `routes`.
    - A feature never imports another feature.
    - `server` is never imported from client code.
    - Use `eslint-plugin-boundaries` or `no-restricted-imports`.
  - `$effect` banned outside `src/lib/ui/` and `src/lib/features/*/effects.ts`. Message: "derive with $derived or move side effects to the feature's effects.ts".
  - Comments: ban line and block comments in `src/` except `// why:` prefixes and tool directives (`@ts-expect-error` with a reason, `eslint-disable-next-line` with a reason). A small custom rule.
  - Ban `setTimeout`, `requestAnimationFrame` and `requestIdleCallback` in features outside `effects.ts`. They mask ordering bugs, per the talk.
- Markdown allowlist check (`scripts/check-md.ts`, run in CI). Allowed:
  - `README.md` (root, short: what it is and how to run it)
  - `data/README.md`
  - `team/**`, `profiles/**`, `prompts/**` (methodology content)
  - `.sprint/**`, until close

  Any other `.md` fails, and the failure message states the policy.
- `features.yaml` at the root: one entry per user-visible feature with `route` and `e2e` test file. `scripts/check-features.ts` fails if an entry's route or test file is missing, or if a route under `src/routes` has no entry.
- Tests: vitest (unit) and Playwright (e2e) with two projects, mobile WebKit (iPhone 15) and mobile Chromium (Pixel 7). Screenshots go to `test-results/`.
- `pnpm check` is the single full gate: svelte-check, eslint, vitest, check-md and check-features. CI runs those jobs in parallel plus e2e. EMs use `pnpm check` before every merge (sprint gotcha 11a).
- CI (GitHub Actions):
  - pnpm store cache
  - parallel jobs: typecheck, lint, unit, policy, e2e
  - e2e uses the official Playwright Docker image so local Docker runs match CI
  - e2e uploads screenshots as an artifact and posts a comment on the PR linking to them
- Mobile baseline from README § Design: `app.html` meta tags and `src/lib/ui/tokens.css`.
- A placeholder route `/` that renders "Today" in the tokens, enough for e2e to screenshot.

## Pre-conditions
- `pnpm` on the host (`npm i -g pnpm`). Ask the CEO before installing global tools if blocked.
- Vercel is connected. Confirm the preview deploy appears on the PR.

## Acceptance criteria
- [x] `pnpm check` exits 0 on a clean clone (mechanical). Verifier: fresh clone at d003a28, frozen install, EXIT 0, 53 tests.
- [x] CI runs on the PR, and every job name appears in the run trace (mechanical: list job names). Verifier: run 44209459070 typecheck, lint, unit, policy, e2e, evidence all success; main run 44210814289 success.
- [x] The boundary rule fires on a deliberate violation (mechanical: add a temporary file in the verifier's worktree importing `features` from `domain`; lint fails with the named message). Verifier: golden-hour/layer-boundaries fired for domain to features, feature to feature, and server from a feature.
- [x] `$effect` in a feature file fails lint (mechanical, same method). Verifier: fires in features/today; silent in src/lib/ui and features/*/effects.svelte.ts.
- [x] A new `foo.md` at the root fails `check-md` (mechanical). Verifier: exit 1 with the policy message.
- [x] A route without a `features.yaml` entry fails `check-features` (mechanical). Verifier: /week exit 1.
- [x] The Vercel preview URL loads `/` (empirical: curl it, expect 200). Verifier: preview returns 302 because of SSO (scope ruling); the Vercel preview check succeeded and production returns 200 with theme-color #06090b and viewport-fit=cover.
- [x] An e2e screenshot of `/` exists for both mobile projects (empirical: artifact list). Verifier: artifact e2e-screenshots has 2 files; both PNGs are inline on ci-evidence and show real renders.
- [ ] HUMAN: CEO opens the preview on their phone. Tokens look right and there's no tap flash.

## Callsite map
New project. Existing `data/`, `team/`, `profiles/`, `prompts/`, `bin/` and `chat*.jsonl` stay untouched. Add `node_modules`, `.svelte-kit`, `test-results` and `playwright-report` to `.gitignore`.

## Test plan
Unit tests for the custom lint rules (RuleTester). Policy scripts each get one passing and one failing fixture.

## Risks
Over-building the guardrails. Ship the listed rules only. New rules arrive later, one per real review finding.
