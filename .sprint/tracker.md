# Golden Hour app v1 — execution tracker

> Single source of truth for the multi-session PM/EM rotation. Append-mostly. Every iteration checks §1 against reality first (git, gh, worktrees).
> Pattern: `/sprint` (boilerplate-skills/skills/sprint), INDEPENDENT shape. Definition and design: `.sprint/README.md`. Workstreams: `.sprint/ws-NN-*.md`.
> **PM resuming after a compaction:** load the `sprint` skill, then read this file §1–§3, then README.md. Don't re-ask the CEO anything recorded here.

## §1 Active state
- Stage: 3 in progress. 2026-11-17: CEO "go for the sprint, complete end to end"; Turso credentials are saved in Vercel env.
- Shape: INDEPENDENT PRs to `main`. All work is additive; a half-shipped state is survivable.
- Ground truth: GitHub PR state (`gh pr view --json state,mergeStateStatus,statusCheckRollup`) plus GraphQL review-thread counts.
- Repo: github.com/jasontd92/golden-hour (private). Base `origin/main`; re-query the tip with `git rev-parse origin/main`.
- Base health: green, and production deploys. Sync is blocked on CEO env: SYNC_TOKEN is unset; TURSO_DATABASE_URL has an unsupported scheme (it must start with libsql:// or https://). Health: GET /api/sync, where done is 200 {token:true, database:ready}.
- PM rulings for WS5b: unlinked /sync route for token entry; header slot shows 'Offline' or 'Not synced' only; never 'synced'; fixed 1:30 rest; Start shows pre-plan, entries record performed-at time.
- Vercel: connected. Turso: DB created, credentials in Vercel env (CEO, 2026-11-17).
- Codex review: CEO enabling async. Not a blocker.
- Open PRs: see gh. Live subagents: ws3-impl, ws4-impl, ws5a-impl (worktrees ../golden-hour-wt/<ws>).
- Merged + verified: WS1 → d003a28 → PASS WITH GAPS 8/9 (HUMAN phone check pending). WS7 → c1d1bba → PASS WITH GAPS 3/3 + HUMAN. WS2 → 7156081 → PASS WITH GAPS 5/5 (one criterion superseded by the plan's 85% TM).
- Production URL: https://golden-hour-iota-three.vercel.app/ (previews are behind Vercel SSO).
- Parallel track (not an EM chunk): Evolution 5 coaches debate, PM-moderated with the CEO. Starts after WS2 merges, since its output is `PlanSession` JSON. First agenda items:
  1. Does the 2–3 hard-sessions cap apply to running quality only, or to metcons too? PM recommendation: running only.
  2. What replaces Kong is King (lost) in the test battery?
- Next chunks: WS3, WS4, WS5a running. Then WS5b (log UI, after WS4), WS6 (after WS3), WS7b (scorer fixes).
- WS5 split (PM, 2026-11-17): WS5a is the data layer (IndexedDB outbox, /api/sync, Drizzle/Turso, property test + mutation proof). WS5b is the log UI on top of WS4's shell. This avoids one EM idling until WS4 merges.
- WS7b queued: (1) the scorer opens subagent files from every ancestor-path project folder (e.g. -Users-jason/*, i.e. other projects) and reads a 64 KB buffer before rejecting; it should read one line and limit which parent folders it scans. (2) The commits metric is always empty because agents use `git commit -q`; derive commits from git log instead. (3) Exclude in-progress sessions, or label them.
- Methodology facts surfaced by WS2 (the plan wins over the sprint docs): TM = floor(0.85×1RM, 5); week 1 is 5's PRO (no AMRAP); Evo 5 runs 17 weeks (retest in 16–17). The fixture's Monday keeps the mockup values as a placeholder.

## §2 CEO directives (durable — read every iteration)

### Product
- Single user, phone-first PWA, web-enabled. No auth, not a product; multi-user is a future refactor.
- Design v0 approved (after the vuca.dev theming): README § Design. Simple and elegant, progressive disclosure, nothing verbose on screen.

- Desktop vs phone (CEO, 2026-11-17): on desktop the user is planning and reviewing, so a calendar-style planning view is the default there. On the phone the default stays Today: today's workout and logging, with the week secondary. A desktop design pass (Pass 3) goes to the CEO for approval before any desktop chunk is built. WS4 ships the phone design in a centred column on wide screens, with a layout-level breakpoint seam. The desktop chunk will need one desktop Chromium e2e project: a deliberate, narrow exception to the "no desktop matrix" cut.

- Desktop Pass 3 approved (CEO, 2026-11-17), with every PM recommendation accepted:
  - the default view shows all 17 weeks
  - session names go in the column headers; the cells show only what changes
  - no Sunday column, and no logging on desktop
  - a missed day is an empty cell: no badges, no adherence percentage
  - "Progress" naming, and charts drawn "up is better"
  - P3Week is rejected as the default
- SYNC_TOKEN (CEO, 2026-11-17): the PM may generate it; the CEO adds it in Vercel when they're ready to use the app. Not a blocker for the code.

- CEO answers, 2026-11-18 (verbatim intent):
  1. Cap the Progress lists: yes, per the PM recommendation (favorites + the test battery, the rest behind "All").
  2. Add the 2026-11-16 CFT lifts (255/160/335) to lift evidence (a curated-data change, approved).
  3. A session-level record (done + session RPE + score for sessions without sets): yes.
  4. Benchmarks: "open to any being replaced; a new baseline is on the table, but not change for its own sake. The existing set has history to trend from. Benchmarks should cover the modalities and all the cardiovascular types the coaches and methodologies collectively represent."
- SYNC_TOKEN is added in Vercel (CEO).
- Overnight (CEO is away until 07:00 MT 2026-11-18): "I trust your judgement based on the design principles we've discussed." Stretch goal if everything closes early: explore what formal verification and other levels of verification beyond the codebase would look like, to test whether agents merge CORRECT code (functional, performant, efficient) without human supervision. A write-up only, no expectations.

### Prose and docs policy
- Durable intent only. Semi-permanent design decisions, the why and the focus. Mostly the methodology side (`team/`, `profiles/`, `prompts/`).
- No planning artifacts or prescriptive agent instructions that need upkeep. Code documents itself through function names, variable names and directories.
- ~No comments (`// why:` only, rare). Markdown allowlist enforced by CI. `.sprint/` is deleted at program close.
- Every recurring review finding becomes a type, lint rule or test (lint first, clean old examples, then verification), not a sentence in a doc.

### Workflow
- One EM owns one chunk end-to-end: worktree → implement → PR → review loop → merge → §3 handoff → teardown → exit.
- EMs: `subagent_type: general-purpose` with a `name:` (gotcha 19). Run in the background. A fresh read-only verifier per chunk after merge, and it is the only actor that ticks boxes.
- PM never reads code or debugs. Stuck → dispatch a fresh diagnostic agent.

### Pre-merge gates (EM enforces; GitHub auto-merge OFF)
- `pnpm check` exits 0, naming the tree it ran on, with the log attached to the PR.
- All CI jobs green on the head SHA, re-queried at the moment of merge.
- Codex review present on the head SHA, once Codex is enabled on the repo (check whether a Codex review or comment exists on any PR; if none ever, skip).
- 0 unresolved review threads (GraphQL). Codex never auto-resolves: reply with the fix SHA or dismissal rationale, then `resolveReviewThread`.
- `main` green between merges. If red, HALT the queue (same-SHA re-run first to rule out a flake, A13).
- Merge: `gh pr merge <N> --squash --delete-branch`.

### Verification posture
Blast radius: one user's broken page. Default is ship and observe. Hold the line on exactly three things, each proven, not asserted:
- (A) No log entry is ever lost: WS5 property test plus mutation proof.
- (B) The TS data port reproduces build.py exactly: WS3 parity diff.
- (C) `main` stays green and deploys to Vercel.

Explicitly cut, so don't reintroduce:
- TLA+ and Lean
- auth and multi-user
- desktop-browser e2e matrices (only mobile WebKit and mobile Chromium)
- visual-regression pixel diffing (screenshots are evidence, not gates)
- Storybook

### Evidence (CEO, 2026-11-17)
- Screenshots render inline in the PR comment, never as a zip that has to be downloaded.
- A screenshot is evidence only if the page has actually rendered: wait for fonts and network idle, and assert that the theme applied, so a blank render fails the test.

### Who ticks acceptance criteria
- The implementing EM never ticks its own boxes. It lists criterion → evidence in its exit summary.
- The verifier ticks mechanical and empirical criteria in the WS doc.
- HUMAN criteria go to the morning report for the CEO.

### Concurrency (binding constraint: shared root files, not RAM)
- WS1 runs alone; it touches package.json, the lockfile, eslint config and CI.
- After WS2: at most 3 impl EMs at once, each in its own git worktree under `../golden-hour-wt/<ws>`.
  - A chunk that must change root config (package.json deps, eslint, CI) rebases right before merge.
  - Lockfile conflicts: resolve by re-running `pnpm install`, never by hand-editing.
- e2e runs in CI (Playwright Docker image). Local Docker e2e is optional, one run at a time program-wide.
- No devcontainers, so sprint gotchas 5–11 (container teardown, shared Postgres) don't apply.

### Commits and git
- Conventional Commits. NEVER an AI co-author trailer (CLAUDE.md, all repos).
- `git add <paths>`, never `-A`. Never `git stash`.

### HALT — escalate to the CEO, don't decide
- Spending money or creating accounts (Turso plan, a paid Vercel feature, domains).
- Installing global tools beyond pnpm.
- Anything that sends personal training data to a new external service.
- Changing `data/raw/` (immutable) or curated facts.
- Changing the design tokens or screen structure beyond README § Design.

## §3 Per-chunk handoff log (dispatch order)

### WS1 — scaffold + guardrails + CI — VERIFIED
- Type: impl EM, serial. Doc: ws-01-scaffold.md.
- PR #1, squash-merged as `d003a28`. Head `05f6361`. Branch deleted.
- CI: PR run 44209459070 green (typecheck, lint, unit, policy, e2e, evidence); main run 44210814289 green (evidence skipped on push by design). Vercel success on `d003a28`; production `https://golden-hour-iota-three.vercel.app/` returns 200 with the Today placeholder.
- `pnpm check`: EXIT 0 on a fresh clone of `ws1-scaffold` at `05f6361` (53 unit tests). Log is a PR comment.
- Reviews: none; Codex has never posted on this repo, so the Codex gate was skipped. 0 threads.
- Decisions:
  - Stack: SvelteKit 3.3 (config lives in `vite.config.ts`, no `svelte.config.js`; alias `#lib/*` via package.json `imports`), Svelte 5.57, Vite 8, TypeScript 6.0 (TS 7 is out but kit and typescript-eslint cap at 6), vitest 5, Playwright 1.65, ESLint 10. pnpm 12.21, Node 26 (`engines: 26.x`, `.nvmrc`).
  - Boundaries are a custom rule `golden-hour/layer-boundaries` (resolves relative, `#lib` and `$lib` imports to layers), not eslint-plugin-boundaries. Domain also may not import `svelte`, `@sveltejs/kit` or `$app`.
  - `no-prose-comments` covers every linted file and Svelte HTML comments; it allows `why:`, `@ts-expect-error <why>`, `eslint-disable-next-line <rule> -- <why>` and `svelte-ignore`.
  - `$effect` is allowed in `src/lib/ui/**` and `features/*/effects.svelte.ts`; timers in `features/*/effects.ts` or `effects.svelte.ts`.
  - `eslint.config.js` (JS) imports TS rules natively. ESLint's `.ts` config needs jiti or an unstable flag.
  - e2e tests live in `e2e/`; evidence through `e2e/evidence.ts` `captureEvidence()`: it waits for network idle and `document.fonts.ready`, asserts the `--bg-base` background and that Geist has loaded, then takes a full-page screenshot to `test-results/screenshots/<project>-<name>.png`.
  - Evidence job: PNGs go to the orphan branch `ci-evidence` at `<pr>/<sha>/`. That branch carries `vercel.json` with deployments disabled. One upserted PR comment embeds them via `blob/ci-evidence/...?raw=true`, and the images rendered for a logged-in viewer.
  - No projectService (typed) linting for Svelte files, which keeps lint fast and lets lint tests use virtual files.
- Gotchas:
  - Vercel Deployment Protection (SSO) is on for previews and the `-jasontd92` aliases: anonymous curl gets 302. Only the production domain is public. `golden-hour.vercel.app` is someone else's site.
  - `/* eslint-disable */` (file-wide) suppresses `no-prose-comments` itself. Known gap; `reportUnusedDisableDirectives` is on.
  - WebKit serialises `font-family` without quotes.
  - vitest `requireAssertions` breaks ESLint RuleTester; `lint/rule-tester.ts` wraps each case in `expect().not.toThrow()`.
  - The Playwright image ships Node 26 and has no corepack; pnpm comes from `pnpm/action-setup` with its store cache.
- Drift from WS doc: `data/normalized/REPORT.md` (build.py output) added to the markdown allowlist. Runes need `.svelte.ts`, so the `$effect` home is `effects.svelte.ts`, not `effects.ts`. Acceptance criterion "curl preview, expect 200" cannot pass anonymously because of SSO: the preview loads for a logged-in browser, and production curls 200.
- VERIFIER VERDICT: PASS WITH GAPS 8/9. The 9th is HUMAN: the CEO checks it on the phone (production URL). The e2e mutant claim was inspected, not reproduced; the logic holds.

### WS2 — domain contract — VERIFIED
- Type: impl EM. Doc: ws-02-domain.md. Depends: WS1.
- PR #3, squash-merged as `7156081`. Head `2f8be43`. Branch deleted.
- CI: PR run 44215210775 green (typecheck, lint, unit 149 tests, policy, e2e, evidence); main run 44215462687 success; Vercel success on `7156081`, production 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws2` at `2f8be43` (after the final rebase onto `59aed5c`). Both logs are PR comments.
- Reviews: none, 0 threads (Codex still has never posted).
- Public API (import by file; there's no barrel because `#lib/*` doesn't resolve directories in Node):
  - `#lib/domain/history.ts`: `Workout`, `Result`, `LiftEvidence`, `LiftsFile`, `WorkoutsFile`, `ScoreType`, `ScoreUnit`, `SugarWodSet`, `DatePrecision`, `WorkoutKind`, `WorkoutFormat`.
  - `#lib/domain/plan.ts`: `PlanSession`, `PlanWeek`, `Block`, `BlockKind`, `Prescription`, `PrescriptionKind`, `MovementWork`, `PercentSet`, `planWeeks` (17), `sessionMinutes`, `isHardSession`, `freeTextInWorkBlocks`.
  - `#lib/domain/log.ts`: `LogEntry`, `LogEntryId`.
  - `#lib/domain/strength.ts`: `trainingMax`, `trainingMaxPct`, `wendlerSet`, `estimatedOneRm` (rounded lb), `floorToPlate`, `roundToPlate`.
  - `#lib/domain/score.ts`: `parseScore(score, type)` → `{ value, unit? } | undefined`, `formatScore(value, type)`, `parseClock`.
  - `#lib/domain/movements.ts`: `movementIds`, `MovementId`.
  - `fixtures/plan/week-01.json` (a `PlanWeek`, Mon–Sat; a missing day is rest). `schemas/*.json` from `pnpm schema:emit`. `pnpm plan:check` validates `fixtures/plan/*.json` and runs inside `pnpm policy`.
- Decisions:
  - The plan beats the WS doc: `trainingMax` defaults to `FLOOR(0.85 × 1RM, 5)` (team/draft-plan.md §B), so `trainingMax(295)` is 250 and `trainingMax(295, 0.9)` is 265. `week` runs 1–17 (the retest is weeks 16–17).
  - Blocks hold `prescriptions[]`, not one prescription: Monday's squat block is main sets, FSL and pull-ups. `LogEntry` identifies a set by `sessionDate` + `blockIndex` + `prescriptionIndex` + `setIndex`.
  - `percentSets.trainingMax` holds lb (the doc said `trainingMaxRef`); set loads are `wendlerSet(trainingMax, pct)`, rounded to the nearest 5. Session minutes and session hardness are derived, not stored.
  - Added a `steady` variant (movement + minutes) for Z1 runs and bike. Movement amounts are exactly one of `reps | meters | calories | seconds`, plus optional `load` (lb) and `heightInches`. An absent `load` means bodyweight.
  - Schemas are strict with no transforms or defaults, and the tests assert `parse(x)` deep-equals `x`. Unknown keys fail. `Result` also checks that `date` matches `date_precision`.
  - `layer-boundaries`: non-spec domain files may import only domain and `zod`. Before this, `node:fs`, npm packages and `data/` paths passed. Domain `*.spec.ts` may read repo files.
- Gotchas:
  - Movement ids use underscores (`back_squat`, from movements.json); `lifts.json` keys and workout ids are hyphen slugs (`back-squat`). There's no mapping yet.
  - For WS3: build.py writes Python floats as `235.0` and `14.0` (lifts.json `load`; results `value` for lb, s and pts). `JSON.stringify` writes `235`, so byte-identical output needs a float-aware serializer.
  - `parseScore` reproduces every curated (non-SugarWOD) result in results.jsonl. SugarWOD rows also depend on `best_result_raw` (load, and the time fallback), which the port must keep.
  - Raw float products land just under a half step (175 × 0.7 = 122.49999999999999); `roundToPlate` and `floorToPlate` carry an epsilon.
  - zod keeps an explicit `load: undefined` key, so strip undefined before IndexedDB if that matters.
  - Ajv runs with `validateFormats: false`; zod also emits `pattern`, so dates and uuids are still checked.
- Drift from WS doc: the fixture keeps the mockup (squat TM 265, `225×5+`, AMRAP 12, hard on Mon/Thu/Sat). The plan has squat TM 215, week-1 Leader 5's PRO with no AMRAP set, and a Mon couplet of 2–10 min. Wed and Fri use the plan's TMs (press 135, DL 280) and 5's PRO. data/README lists `date_precision` as day|month|unknown and `format` as 7 values, but the data also has `approx`, `max_hold` and `other`, and one `score.better` is null; the schemas follow the data.

### WS3 — data build port — VERIFIED (via WS3b)
- Depends: WS2. Hold-the-line B. Doc: ws-03-data-port.md.
- PR #4, squash-merged as `c8494f3`. Head `830e215`. Branch deleted.
- CI: PR runs 44225400229 and 44226044061 green (typecheck, lint, unit 190 tests, policy incl. step "normalized data matches a fresh build", e2e, evidence). Main run 44226742954 success; Vercel success on `c8494f3`; production 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws3` at `830e215` (up to date with origin/main). Logs are PR comments.
- Parity (B): before deletion, `python3 -I build.py` and `node scripts/data-build.ts <dir>` ran from the same inputs into temp dirs. `diff -r` exit 0, all 4 files with identical sha256, and also equal to the committed `data/normalized`. A perturbed-input probe (integral-float literal `235.0`, `1:00.0`, `53:13:00`, unparsable score, emoji, quotes) also gave zero diff. The drift proof: in a scratch clone, editing `curated/results.json` made `pnpm data:build && git diff --exit-code data/normalized` exit 1. All three are PR comments.
- Reviews: none, 0 threads (Codex still has never posted).
- Public API:
  - `#lib/domain/movements.ts` gains `Modality`, `MovementDefinition`, `MovementVocabulary` (the movements.json schema), `compileMatchPattern`, `movementTaggers`, `tagMovements(text, taggers)` and `summarizeTags(ids, vocabulary)` → `{ patterns, modality, homeOk }`.
  - `pnpm data:build [outDir]` defaults to `data/normalized`; it validates against WS2 zod before writing.
  - `scripts/python-json.ts`: `pythonJsonDumps`, `pythonRepr`, `parsePythonJson`, `PyFloat`. `scripts/csv.ts` is a csv.DictReader equivalent.
- Decisions:
  - The drift check is a step in the policy job, not a new job, to avoid another setup.
  - `data-build.spec.ts` also asserts committed == fresh build, so `pnpm check` catches drift locally.
  - The output keeps Python's int/float distinction. A time with no fraction is an int; every other parsed value is a float. Float literals in input JSON stay floats, via the `JSON.parse` reviver `context.source` (Node 26).
- Gotchas:
  - movements.json patterns are Python `re`: `compileMatchPattern` turns `\b`/`\d`/`\w` into Unicode-aware forms (`Thrusterä` tags nothing, as in Python) and throws on escapes it can't translate (e.g. `\s`), so new patterns fail loudly.
  - `canonical` keeps unit `s` on unparsed time scores, which `parseScore` alone loses. The load path uses `best_result_raw`. Time falls back to the digits in `best_result_raw`.
  - The build reads `data/` relative to the cwd.
- Drift from brief: none found. Committed normalized output already matched a fresh build.py run. The score.spec describe names no longer mention build.py.

### WS4 — shell, PWA, Today, Week — VERIFIED (verifier PASS WITH GAPS 4/4 + HUMAN iPhone install; hard dots come from the fixture, Mon/Thu/Sat vs the plan's Mon/Wed/Fri; fixture notes repeat the structured sets, which is too wordy)
- Type: impl EM. Doc: ws-04-shell-today-week.md. Depends: WS2.
- PR #6, squash-merged as `bdc3b36`. Head `8ef1082`. Branch deleted.
- CI: PR runs 44225689094, 44226008491, 44226923769, 44227206465 (one per rebase) and 44228438020 (final head) green: typecheck, lint, unit, policy, e2e (16/16: 8 tests × mobile-webkit and mobile-chromium), evidence. Main run 44228693700 success. Vercel production success on `bdc3b36`; production `/manifest.webmanifest` returns 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws4` at `8ef1082` after the final rebase onto `35c8e2e` (239 unit tests). Logs are PR comments.
- Merge was held by the PM's halt (red production after WS5a) and done after the all-clear on `35c8e2e`; WS4 merged before #8 (ws6) and #9 (ws3b).
- Reviews: none in the window (Codex has still never posted). 0 threads.
- Public API / seams for later chunks:
  - Shell: `src/routes/+layout.svelte` `.shell` owns `--tab-bar-height` and `--shell-width`. A single layout-level breakpoint (`@media (min-width: 768px)`) sets `--shell-width: 430px`, so wide viewports get the phone layout in a centred column (the interim state per the CEO desktop directive). The desktop chunk switches its layout or default route at that one place: swap the shell contents, or route `/` by viewport, there. No desktop components exist yet.
  - Start seam (WS5b): `features.yaml` `today.flags.start: false`. `/+page.server.ts` reads it via `#lib/server/flags.ts` `featureFlag('today','start')`. `/+page.svelte` builds `startHref` as `/log/<date>`, and `SessionView` renders the Start link. WS5b adds `src/routes/log/[date]`, changes the href to `resolve('/log/[date]', { date })`, deletes the `eslint-disable-next-line svelte/no-navigation-without-resolve` line in `SessionView.svelte`, and flips the flag. The update prompt is suppressed on `/log*` (`midSession` in the layout).
  - Plan: `#lib/server/plan.ts` `loadPlan()` (glob of `/fixtures/plan/*.json`, `PlanWeek`-validated, throws on a bad file). `#lib/domain/schedule.ts` `planSessions`, `pickToday` (before the plan starts → first session with `beforePlan`; no session that day → rest), `focusDate`, `weekView` (Mon–Sun, clamped to the plan). `#lib/domain/calendar.ts` holds date labels. `#lib/ui/clock.svelte.ts` `clock.today` holds the local date and refreshes on visibility/focus.
  - Today: `#lib/features/today/SessionView.svelte` (also used by `/day/[date]`), `prescription-lines.ts` `blockLines(block)` → `{ text, tone: plain|quiet|strong }`, `movement-labels.ts` (`Record<MovementId, [one, many]>`, which tsc keeps exhaustive).
  - Week: `#lib/features/week/Week.svelte`. Rows link to `/day/[date]` (prerendered through `entries`); the highlighted row (the day Today shows) links to `/`.
  - UI: `TabBar.svelte` (Progress is an inert span until WS6 adds a link with `resolve('/progress')`), `HardDot.svelte`, `UpdatePrompt.svelte`, `service-worker.svelte.ts` `appUpdate`.
- Decisions:
  - Every page is prerendered (`+layout.server.ts` `prerender = true`). Plan data reaches the client as layout data (`__data.json`), so zod never ships for validation.
  - Service worker `src/service-worker/index.ts` (a directory with its own tsconfig extending `$app/tsconfig/service-worker`; the root tsconfig excludes it; `pnpm typecheck` adds `tsc -p src/service-worker`). It precaches `immutable` + `assets` + `prerendered` (every page and its `__data.json`) and serves them cache-first by pathname. The first install calls `skipWaiting` because no session is open. Updates wait for the "Update ready · Reload" tap, then `skip-waiting` runs and the page reloads on `controllerchange`. The app checks for an update on each visibility change (iOS PWAs rarely relaunch).
  - Manifest `static/manifest.webmanifest`: standalone, `#06090b`, icons 192/512/maskable 512, apple-touch-icon 180, `apple-mobile-web-app-status-bar-style: black-translucent`. Icons are a teal half-sun over an accent-2 horizon, generated once with PIL (no script committed).
  - `check-features` validates optional `flags` as a map of booleans.
  - A scheme header (e.g. `AMRAP 12`) is omitted when it equals the block name, matching the mockup. A uniform `percentSets` group collapses to `5 × 5 at 170`, and an AMRAP set renders strong as `225 × 5+`.
- Gotchas:
  - Kit 3 removed `$service-worker`: use `$app/manifest` (`immutable`, `assets`, `prerendered`, with paths relative to base and no leading slash; `''` is `/`), `$app/env` `version`, and `$app/service-worker` `self`. `$app/environment` is now `$app/env`.
  - `svelte/no-navigation-without-resolve` is syntactic (typed lint is off): an href passed through a prop fails, so components that render links call `resolve()` themselves.
  - `svelte/prefer-svelte-reactivity` flags `new Date()` in `.svelte.ts`; `localIsoDate` takes epoch ms.
  - e2e pins the clock (`e2e/clock.ts` `openOn`), so tests don't drift with the real date.
  - Full-page screenshots draw the fixed tab bar at the original viewport bottom, so when the page is taller than the viewport the bar overlaps content in the PNG. That's a screenshot artifact, not a layout bug.
  - Local Playwright browsers on the host are older than 1.65; e2e ran in CI only.
- Drift from WS doc / brief: the mockup's "Week 1 of 16" renders as "of 17" (`planWeeks`, per WS2). The WS doc says `src/service-worker.ts`; Kit 3's sync expects `src/service-worker/` with its own tsconfig. Lighthouse isn't run; the manifest is asserted by a unit test (fields, icon PNG sizes) and an e2e test (linked, fetchable, icons 200). Progress isn't tappable yet.
- HUMAN pending: CEO installs to the iPhone home screen and checks full screen and the status bar.

### WS5 — split into WS5a/WS5b (see below)
- Depends: WS2 (data layer); WS4 (UI mount). Hold-the-line A. Doc: ws-05-logging-sync.md.

### WS6 — progress — MERGED
- Depends: WS3. Doc: ws-06-progress.md.
- PR #8, squash-merged as `255fb58`. Head `8eb1692` (rebased onto WS4 `bdc3b36`, then `fcd3cf9`). Branch deleted.
- CI: PR runs 44228879927 (on e46f64d) and 44229208568 (on 8eb1692) green: typecheck, lint, unit 278, policy, e2e (both mobile projects), evidence. Main: run 44229427972 on `255fb58` was cancelled twice (a newer main push replaces a queued run in `ci-${{ github.ref }}`). The next run, 44229556777 on `c8301c5` (255fb58 + `.sprint/` only), succeeded. Vercel success on `255fb58`; production `/progress` returns 200, and `/progress/benchmarks/fran` serves 4:43.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws6` at `8eb1692` (up to date with origin/main). Three logs are PR comments.
- Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/progress.ts`: `bestResult(workout, results)` → `{ result, conflicted }`, `benchmarkWorkouts`, `benchmarkRows`, `bestOneRepMax`, `liftRows`, `liftName`, `resultHistory`, `liftHistory`, `dateLabel`, `sourceLabel`, `displayScore`; types `ProgressRow`, `HistoryRow`.
  - `#lib/server/history-data.ts`: `workouts`, `results`, `lifts`, the normalized files bundled with `?raw` and parsed with the WS2 zod schemas.
  - Routes (all prerendered): `/progress`, `/progress/benchmarks/[id]`, `/progress/lifts/[id]`. The `TabBar` Progress tab is now a link, current on any `/progress*` route.
- Decisions:
  - Best = the `score.better` sort over non-conflicted results only; on a tie, the earliest wins. A muted ring (sr text "Sources disagree") appears when a conflicted result ties or beats the shown best. CrossFit Total shows 845 (SugarWOD 2023-10-30) with the marker; Cindy shows 22+16 with the marker.
  - Benchmarks: favorites, then `kind: test`, then girls with ≥2 dated scored results; within each group, by scored-result count, then name. Excluded: workouts with `definition_status` (Kong is King, Launchpad), `score.better: null` (vertical jump), and workouts without scored results. That makes 21 rows, against 6 in the mockup.
  - Lifts: `lifts.json` only, max of `reps === 1` evidence (11 lifts), ordered by load, named from the slug ("Back squat"). History lists all evidence: `load × reps`, or the bare load when reps is null.
  - Dates: day "May 11, 2023", month "Aug 2025", approx "~Aug 7, 2023", unknown → `date_text`; undated lift evidence → "Undated". Sources: SugarWOD / SugarWOD profile / Sheet / Notes by prefix; an unknown prefix falls through raw.
  - History is a separate route, not an in-place panel. Duplicate (`duplicate_of`) results stay in the history, since rule 1 keeps every observation.
- Gotchas:
  - `svelte/no-navigation-without-resolve` needs `resolve()` inline in the `href` attribute; a helper function returning `resolve(...)` still fails.
  - Main CI: tracker-only pushes right after a merge make the merge SHA's queued run get cancelled, so check the next main run.
  - Local Playwright browsers are stale (1243 vs 1255). Rely on CI e2e.
- Drift from WS doc: none for values. Best Fran 4:43, back squat 1RM 295 and CFT 845 (non-conflicted) all verified against `data/normalized`. The README lists `date_precision` without `approx`; it's handled.
- Recommendations: (1) The 2026-11-16 CFT lifts (255/160/335) are in `results.jsonl` `detail` only; adding them to lift evidence is a curated-data change for the CEO. (2) CEO: decide whether 21 benchmarks and 11 lifts is "short" enough, or whether to cap to main lifts / recurring tests. (3) `benchmark-anaerobic` (the only unknown-precision results) is not listed: it isn't a favorite, test or girl, and its course varies.

### WS7 — agent-session scorer — VERIFIED
- Type: impl EM. Doc: ws-07-session-scorer.md.
- PR #2, squash-merged as `c1d1bba`. Head `cde061d`. Branch deleted.
- CI: PR run 44214496538 green (typecheck, lint, unit, policy, e2e, evidence); main run 44214711979 green (evidence skipped on push).
- `pnpm check`: EXIT 0 on `../golden-hour-wt/ws7` at `cde061d` after the final rebase (68 unit tests, 15 in `scripts/score-sessions.spec.ts`). Logs are PR comments.
- Reviews: none in a 10-minute window; Codex has never posted, gate skipped. 0 threads.
- Real run (10 sessions, aggregate only): 2h40m, 425 tool calls, 32.5M cache-read tokens, 15 failed calls, 3 retried commands, 0 repeated searches; ws1-impl PR #1 green on the first CI run, 0 threads, 0 reverts.
- Decisions:
  - Code: `scripts/score-sessions.ts` (CLI, table, totals) and `scripts/sessions/{transcripts,metrics,github}.ts`. Flags: `--json`, `--root`, `--projects`, `--no-github`. Root defaults to the parent of `git --git-common-dir`, so it works from any worktree.
  - Discovery: project dirs named after the root or its worktrees are read in full. Ancestor dirs (e.g. `-Users-jason-Documents`) contribute only `<session>/subagents/*.jsonl`, never their top-level sessions. A file is kept only if its first cwd-bearing record is in the repo or `golden-hour-wt/*`; otherwise reading stops at that record. Foreign-cwd records inside a kept file are dropped.
  - Tokens are deduped by `message.id`, because one API message spans several records that repeat the same usage.
  - Session label: `name` from the subagent's `.meta.json` (e.g. `ws1-impl`), else `session-<uuid8>`.
  - PRs come from `toolUseResult.gitOperation.pr` with action created or merged (commented is excluded, so a verifier commenting on a PR doesn't own it), plus the URL printed by `gh pr create`. Commits come from `[branch sha]` lines in `git commit` output.
  - "1st rel" counts Read/Edit/Write and Bash commands that name a file from the session's commits or PR (agents mostly read through Bash in auto mode). "Unused reads" counts only Read-tool paths.
  - A failed Bash command counts as retried if a later command has the same program and subcommand after stripping `cd … &&`.
  - "CI to green" counts PR-event runs in creation order up to the first success, or `never/N`.
- Gotchas:
  - `gitBranch` on subagent records is the PM checkout's branch (`main`), not the EM's worktree branch, so the branch can't come from the transcript; it comes from `gh pr view`.
  - `gh api graphql -F owner={owner} -F repo={repo}` placeholders work.
- Brief errors: EM transcripts are not under the `-…-golden-hour*` project dirs. They live under the PM session's dir (`-Users-jason-Documents/<pm-session>/subagents/`), next to non-repo subagents, which is why discovery filters by cwd.

### WS2 verdict
- VERIFIER: PASS WITH GAPS 5/5.
- Plan TMs (215/135/280) come from the 2026-11-16 CrossFit Total (255/160/335, in results.jsonl), not from lifts.json. lifts.json's all-time bests (295/165/365) would give 250/140/310. Plan sessions must carry explicit `trainingMax`; never derive it from lifts.json. WS6 should consider whether the 11/16 CFT lifts appear as lift evidence.
- CI's vitest reporter prints only per-file counts. Verifiers take test names from local verbose runs.

### WS7 verdict
- VERIFIER: PASS WITH GAPS 3/3 mechanical, HUMAN pending. Privacy of the scored set is proven by mutation. Gaps go to WS7b.

### WS3 verdict
- VERIFIER: FAIL on hold-the-line B with adversarial inputs. Real-data parity is exact (sha256-identical) and the other criteria pass. The divergences:
  - (1) Integer-like object keys (e.g. splits {"10","2","1"}) get reordered by JS objects.
  - (2) Unicode digits and exotic whitespace in score strings parse differently from Python.
  - (3) Repr of emoji newer than Python 3.11.
  - None occur in today's data.
- PM ruling: build.py is gone, so the TS build is now the reference. WS3b makes each divergence impossible rather than reproducing Python quirks:
  - (1) Preserve key order, or reject integer-like keys at the schema level.
  - (2) Reject score strings with non-ASCII digits, BOM or control characters, failing loudly in the build.
  - (3) Accepted, and recorded here.

### WS3b — data build hardening — VERIFIED (verifier PASS WITH GAPS 7/7; parity box ticked under the PM ruling)
- PR #9, squash-merged as `87fed7d`. Head `a47c6ab`. Branch deleted.
- CI: PR runs 44228279582 and 44228489769 (after rebase on `8d41ec2`) green (typecheck, lint, unit, policy, e2e, evidence). Main run 44228686106 success; Vercel production success on `87fed7d`; production 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws3b` at `a47c6ab` (227 tests). `pnpm data:build` gives zero diff in `data/normalized`. Logs are PR comments.
- Reviews: none, 0 threads.
- Decisions:
  - (1) Reject over preserve. `parsePythonJson(text, origin)` throws on any non-array key matching `^\d+$`, naming the origin (the curated file, or `sugarwod#rowN set_details`) and the key. Since JS has already reordered the keys, the message names the first key in JS order (e.g. "1", not "10").
  - (2) Score strings (curated `score`, SugarWOD `best_result_display`/`best_result_raw`) must be printable ASCII U+0020–U+007E. Otherwise the build throws, naming the record (`curated/results.json[i] (workout date)` or `sugarwod#rowN column`) and the code point. Today's data has no such characters.
  - (3) Accepted per the ruling; no work.
- Tests: `scripts/data-build.spec.ts` builds perturbed copies of `data/curated` and `data/raw/sugarwod` in a temp root. It covers the integer-key case (curated splits and set_details), Arabic-Indic and full-width digits, BOM, `\x1c`, `\x85` and NBSP, plus SugarWOD display/raw. Mutation proof (in the PR body): removing the key guard fails 2 tests; removing the score guard fails 8.
- Gotchas: a fixture built with `JSON.stringify` already reorders integer keys, so the integer-key fixture is written as raw text.

### WS5a — logging data layer + sync — VERIFIED (PASS WITH GAPS)
- The no-loss property holds for one device: two of the verifier's own mutants were killed. Gaps:
  - the duplicate check is vacuous
  - partial accepts are never exercised: the ack-all mutant survived
  - drain isn't asserted: the single-batch mutant survived
  - no reload or restart command
  - nothing calls `storage.persist()` (moved to WS5b)
  - previews can migrate and write production if they get the TURSO vars (a CEO env-scoping question)
- WS5c closes the proof gaps.

### WS5c — strengthen the no-loss proof — IN PROGRESS (ws5c-impl)
- Type: impl EM. Doc: ws-05-logging-sync.md (everything except the log UI and the UI e2e). Hold-the-line A.
- PRs, all squash-merged, branches deleted:
  - #5 → `4fd9a0b` (head `b7ac9b1`): the main chunk.
  - #7 → `35c8e2e`: fix-forward, migrate on first request.
  - #10 → `c7baeaa` (head `81a68a9`): fix-forward, web libSQL driver, and /api/sync never returns 500.
- CI:
  - PR runs 44226919662 (#5), 44227742425 (#7) and 44228820621 (#10): all jobs green.
  - main: 44227126050 (`4fd9a0b`) success; 44227951660 (`35c8e2e`) success; `c7baeaa` cancelled as superseded, and the run covering it, 44229069558 on `fcd3cf9`, succeeded.
  - Vercel production: FAILED on `4fd9a0b` and `7fc720c` (my build-time migrate step); success on `35c8e2e`, `c7baeaa` and `fcd3cf9`. Production `/` returns 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws5a` for each head, after rebasing (the last was 253 tests on `81a68a9` over `bdc3b36`). The logs are PR comments.
- `pnpm proof:sync`: EXIT 0. The positive control passes, and the PR #5 comment records 4/4 mutants killed, each with a changed-line count. #10 re-ran it 3 times, 4/4 each time.
- Reviews: none, 0 threads. #7 and #10 merged straight after green CI, without the 10-minute window, because production was red or broken.
- Public API:
  - `#lib/domain/log.ts`: `LogRecord` (LogEntry + `revision` + optional `deletedAt`), `SyncRequest` `{records}` (1–100), `SyncResponse` `{accepted: ids}`, `syncBatchLimit`; `schemas/log-record.json`.
  - `#lib/features/log/store.ts`: `openLogStore()` returns `LogStore`, with `save`, `undo` (a tombstone), `amend` (rpe/note), `entries` (non-undone), `pending`, `pendingCount`, `acknowledge(sent, accepted)` and `close`.
  - `sync.ts`: `syncOutbox(store, transport, batch?)` returns a `SyncOutcome`; `httpTransport(token)`.
  - `effects.ts`: `startSyncLoop(store, () => transport | undefined, onOutcome)`. It syncs on open, on `online` and on `request()`; backs off from 1s to 60s; stops on 401; runs one sync at a time.
  - `entry.ts`: `newLogEntry(set, deviceId, now?)`. `device.ts`: `deviceId()`, `syncToken()`, `saveSyncToken()` (localStorage).
  - Server: `/api/sync`.
    - POST takes a Bearer `SYNC_TOKEN` and upserts by id, where a newer revision wins. A missing token, a database that isn't ready, or any throw gives 503, and nothing is accepted. A wrong token gives 401; a bad batch gives 400.
    - GET is health: `{token, database: ready|unmigrated|unconfigured|error, reason?}`. The reason is the error name plus a code, never a value.
- Decisions:
  - Every set carries a `revision`. The client marks a record synced only if its stored revision still equals the one it sent, so an undo during an in-flight sync survives.
  - Undo and amend both bump the revision, and the server ignores revisions that aren't newer, so a replayed old request can't resurrect an undone entry.
  - Migrations: drizzle-kit generates `drizzle/*.sql`, which is committed. `src/lib/server/db/migrate.ts` bundles them through `import.meta.glob` and applies them on first use, once per instance, retrying after a failure. It keeps drizzle-kit's `__drizzle_migrations` bookkeeping, and a test checks compatibility both ways. Builds never touch the DB, so previews can't migrate production.
  - Remote URLs use `drizzle-orm/libsql/web`. The node driver, which needs the native binding, is a dynamic import only for `:memory:` and `file:`.
  - Kit 3 has no `$env/*`: the variables are declared in `src/env.ts` (`defineEnvVars`) and read from `$app/env/private`.
  - Lint: route specs may now import `src/lib/server`. `no-unused-vars` has `ignoreRestSiblings`.
  - The property test lives in `src/routes/api/sync/sync.spec.ts`. It runs 2000 runs (about 2s) against the real `+server.ts` over `:memory:` libSQL, with fake-indexeddb for the client.
- Gotchas:
  - `drizzle-orm/libsql` statically imports `@libsql/client`'s node entry, which loads the native `libsql` binding when imported. That gave 500s on Vercel and probably also failed the build-time migration (#5).
  - drizzle libsql `db.get()` on an empty result throws; use `all()`.
  - `vi.mock` of `$app/env/private` works.
  - At 300 runs the replay mutant sometimes survived, so keep the property at 2000 or more.
- **Production state (GET /api/sync at `fcd3cf9`):** `{"token":false,"database":"unmigrated","reason":"LibsqlError URL_SCHEME_NOT_SUPPORTED"}`, status 503.
  - **SYNC_TOKEN is NOT set** (HALT, CEO: pick the secret and add it to Vercel, then enter it on the phone).
  - **The `TURSO_DATABASE_URL` value has an unsupported scheme** (HALT, CEO). It must start with `libsql://` (or `https://`), with no quotes or other prefix; check it in the Vercel dashboard. Until it's fixed, no migration has been applied to Turso.
  - After the env change, a redeploy is needed. Done means GET /api/sync returns 200 `{"token":true,"database":"ready"}`.
- For the second record kind (session completion): the wire is `{records: LogRecord[]}`, and the store, outbox and ack are keyed on `id` + `revision` + `deletedAt` only. Adding a kind means:
  - an optional `kind` discriminant on the record, where absent means set
  - a second table with the same upsert
  - no protocol break
  The set fields themselves are not yet a union; that's left for the chunk that needs it.
- Brief errors:
  - The brief named `$env/dynamic/private`; Kit 3 uses `$app/env/private` plus `src/env.ts`.
  - The brief's "e2e: log three sets offline…" criterion belongs to WS5b, which needs the UI.
  - The Vercel CLI isn't installed and Vercel API access was denied, so env presence came from the health endpoint.
- Status: MERGED. Verifier pending.
### WS3c — residual data-build gaps — NOT STARTED (queued, low priority)
- (1) A set_details value that is valid JSON but not an array is silently dropped; make it loud.
- (2) The score_type lookup hits the prototype (`toString`); use an own-key lookup.
- (3) Loud errors that don't name the source record should attach the origin.
- Accepted: fail-open movement tagging, title/score_type whitespace variants (these surface in REPORT's unparsed/untagged lists).

### Fixture cleanup (fold into the debate output)
- week-01.json: hard days and Monday TM 265/AMRAP don't match the plan. The notes repeat the structured sets, so drop the duplicate notes. The real plan JSON from the debate replaces the fixture.

### WS5b — log UI — IN PROGRESS (ws5b-impl)
### WS7b — scorer fixes — MERGED
- Type: impl EM (ws7b-impl). Fixes from the WS7 verdict.
- PR #11, squash-merged as `6c9a0fe`. Head `fea17a9`. Branch deleted.
- CI: PR run 44230310218 green on the first head. The rebased head `fea17a9` was green on all jobs (typecheck, lint, unit, policy, e2e, evidence). Main run 44261330700 success. Vercel production success on `6c9a0fe`.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws7b` at `fea17a9`, over `ee4cb50` (284 tests, 21 in `score-sessions.spec`). Logs are PR comments.
  - Main gained `eb228a8` (tracker only) between the gate and the merge. Main CI on the merge commit was green.
- Reviews: none, 0 threads.
- Decisions:
  - Folders scanned:
    - the repo folder and its `<root>-wt-*` folders are read in full
    - the repo's parent folder (`dirname(root)`, which is where the PM runs) contributes subagents only
    - higher ancestors (`-Users-jason`) and lookalike siblings (`<root>-other`) are never listed, statted or opened
  - Sessions started inside a repo subdirectory (`<root>-src`) are no longer found. That's accepted.
  - All fs access goes through an injectable `TranscriptFs`, so tests spy on it. A sync line reader reads 4 KB chunks, so rejecting a file costs only its first record plus at most one chunk. Real run: largest rejected read 8192 B, mean 4915 B.
  - Commits come from `gh pr view --json commits` for the session's PRs, unioned with printed `[branch sha]` lines, as 7-char shas. Without gh, only printed lines count, as before. Real run: 9 EM sessions now have commits.
  - A session counts as running when its meta lacks `finished: true` and its last record is under 30 minutes old (`runningWindowMs`). Running sessions are labelled `(running)`, carry `running: true` in the JSON, and are left out of the totals. The scorer's own session is caught by the same rule.
  - Subagent `.meta.json` now carries `finished: true` once an agent hands back.
- Tests: mutation proof in the PR body, 11/11 guards killed.
- Brief errors: none.
- Status: MERGED. Verifier pending.
### WS8 — desktop planning view — NOT STARTED (needs CEO approval of Pass 3; after WS4, and WS5b/WS6 for review data)

### CLOSE — Stage 5′ — NOT STARTED
- Runner: the full mobile e2e suite on the final `main` tip.
- `pnpm sessions:score` over all sprint sessions → turn the findings into checks.
- Delete `.sprint/`, then write the morning report.
