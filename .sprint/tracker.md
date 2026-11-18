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
- Open PRs: see gh. Live subagents (2026-11-18 overnight): ws5c-impl, ws6b-impl, ws9-impl (Evo 5 plan generator); verifiers ws5b-verify, ws7b-3c-verify.
- Merged overnight: WS7b 6c9a0fe, WS3c 03dceaf, sync-diag c398a9e, WS5b 2d3f61f, Evo 5 plan revision PR #16 e775774 (team/ docs; PM-merged; pending athlete review).
- Production sync is BLOCKED on the CEO: health shows urlScheme 'other'. TURSO_DATABASE_URL must be exactly libsql://<db>-<org>.<region>.turso.io, with no prefix. Then redeploy.
- Queue: WS5d session-level record (approved); WS8 desktop planning view (approved); CLOSE; then the verification stretch write-up.
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

### Review holds and PR descriptions (CEO, 2026-11-18)
- Verbatim: "anything that's a fundamental addition or change (like the formal proofs and frameworks, and so on), once we do open those PRs, I want those paused, not auto-merged, for my own review."
- Verbatim: "The PR description should mainly be a description of what it is, a bulleted list of what was implemented, and maybe interesting areas for me to explore and think about."
- HOLD chunks cover verification frameworks and tooling (canary, budgets, Stryker, seeded-bug benchmark, oracle agent/traceability, model checking, proofs) and any change to how agents work in the repo.
  - The EM takes a HOLD chunk through every gate, then stops before merging: label `ceo-review`, PR stays open, handoff status HELD.
  - The verifier checks the PR head SHA.
  - The CEO merges.
- Concurrency (CEO): at most 3 agents running at once, counting EMs and verifiers together.

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

### WS6b — progress caps + CFT lift evidence — MERGED
- PR #17, squash-merged as `2cd5733`; head `9d8766a` (rebased on `dfebc02`). Branch deleted.
- CI: PR runs 44264267511 (red: All-row text spacing), 44264769126 and 44265246102 green (typecheck, lint, unit 354, policy, e2e both mobile projects, evidence). Main run 44265640775 on `2cd5733` success; Vercel success; production `/progress/lifts` 200 and back-squat history serves "Nov 16, 2026".
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws6b` at `9d8766a`; logs are PR comments. Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/battery.ts`: `testBattery` (the team/draft-plan.md §A1 battery as of the 2026-11-18 revision, catalog ids only) and `batteryRank(id)`.
  - `#lib/domain/progress.ts`: `isTopBenchmark`, `topBenchmarkRows`, `mainLifts`, `isMainLift(id, evidence, today)`, `mainLiftRows(lifts, today)`. `benchmarkRows` and `liftRows` are the full "All" lists.
  - Routes: `/progress/benchmarks` and `/progress/lifts` (the full lists, prerendered). Components: `ProgressList`, `DetailHeader`, `ConflictMarker`.
  - Data build: a curated result may carry `lifts: {slug: load}`, which becomes reps-1 evidence with the result's date and source and the workout name as the note.
- Decisions:
  - Top benchmarks = favorites (by result count) then the battery in plan order: 14 rows. The rest (ski 2000m, King Kong (women's Rx), 200m, 5k, Annie, Grettel, Helen) is behind All, which has 21. A list was unavoidable because the battery includes `kind: girl` workouts and excludes some `kind: test` ones. No exclusion for having fewer than 2 results.
  - Main lifts = back squat, shoulder press, deadlift and bench, plus any lift with dated 1RM evidence ≥ today−3y, with today taken at build time. On today's data that is 4 rows, since every snapshot 1RM is undated.
  - The All row is muted and shows the full count. There are no group labels. The conflict ring stays on the list, keeping its title and sr text, and is now also drawn next to the conflict note on the history page.
  - "King Kong (women's Rx)" comes from curated data, so it was not renamed.
  - CFT 2026-11-16 → back squat 255, shoulder press 160, deadlift 335 (`google-sheet/tests`). Bests stay 295/165/365. `results.jsonl` is unchanged and lifts.json has 89 entries.
- Gotchas: Svelte drops a leading space inside an element (`<span> text</span>`), so put the space outside the span.
- Brief errors: no "WS6 verdict" section existed in the tracker; I used the brief's summary of the verifier notes. The worktree didn't exist and was created.
- Follow-ups: the new battery tests (ring dips, 30-min submax, mile TT, body comp) aren't catalog workouts yet. Add their ids to `testBattery` when they are.
- VERIFIER: WS6b — PASS WITH GAPS. Reproduced: battery.ts = plan §A1 keep/add set minus the 4 non-catalog tests (ring dips, submax, mile TT, body comp, none in workouts.json); Kong and Launchpad absent. Prod /progress shows 14 benchmarks + All 21 and 4 lifts + All 11; /progress/benchmarks has 21 rows and /progress/lifts 11. Back squat history starts "Nov 16, 2026 · Sheet · 255 × 1". The diff touches curated/results.json, data-build.ts and lifts.json only, 86 to 89 entries; data/raw and results.jsonl are unchanged; bests are 295/165/365; data:build plus diff on a fresh clone is clean; `pnpm check` EXIT 0 (354 unit tests). CI 44265246102 had 34/34 e2e; main 44265640775 green; Vercel success on 2cd5733; no AI trailers. Gaps: (1) the 3-year lift window has no effect today, since the only dated 1RMs are main lifts. It is computed at build time, so a future dated non-main lift appears and later drops off on whatever rebuild crosses the 3-year line, and no test pins this. (2) Battery sync for the 4 new tests is manual, and nothing fails when they become catalog workouts. (3) The history conflict note uses "Evo2 test week" jargon and sits on the Aug 7 row while citing Oct dates.

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

### WS5c — strengthen the no-loss proof — MERGED (ws5c-impl)
- PR #15 → `050bbf8` (head `0e180a2`), squash, branch deleted. Test and harness only: no production code or store API change.
- CI: PR runs 44261905130, 44262308085, 44262651249 and the final head all green (typecheck, lint, unit, policy, e2e, evidence). Main run 44263624582 on `050bbf8` success; Vercel production success; `/` 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws5c` after each rebase (last: 347 tests on `0e180a2` over `e775774`). `pnpm proof:sync`: EXIT 0 on every run (6 runs, 3 recorded in full on the PR): control passes, 8/8 mutants killed by a tagged assertion, changed-line counts asserted.
- Property (`src/routes/api/sync/sync.spec.ts`, 2000 runs, ~2.4s in CI): new commands `partialSync` (commit and ack masks), `reload`, `reloadDuringSync` (after commit; the old page's sync never continues), two tabs on one IndexedDB plus `concurrentSync`. Every clean online sync must drain; a separate test drains 250 records in one `syncOutbox` (3 requests). Convergence assertions are tagged `[client] [duplicate] [server] [tombstone] [drain]`; `[server]` compares revision for revision; `[duplicate]` keys on the performed set (device, loggedAt, position, movement), not id. The vacuous id-count check is gone. 30000 runs passed once locally.
- Mutants added: ack ignores accepted ids, sync returns after one batch, store forgets the outbox on reload, server assigns its own ids. A mutant counts only if every failing test failed on a tagged assertion; anything else is `crashed` and fails the proof. `scripts/sync-mutants.spec.ts` tests the classifier and that every mutant still applies.
- Findings (no loss, not fixed): with two tabs syncing at once, the tab that acks second marks 0 and `syncOutbox` returns `failed` although everything is on the server; `startSyncLoop` then backs off and retries. Same after an in-flight undo when the batch is only that record. Cosmetic: a spurious "Not synced"/retry, never a loss.
- Gotchas: fast-check needs `includeErrorInReport: true` or vitest's JSON report drops the assertion cause. The plain-insert mutant dies by `[drain]` (the 503 leaves the outbox full), which is an assertion, not a crash. The server-id mutant's shrunk counterexample fails `[server]` in the property; `[duplicate]` is what kills it in the scripted history.
- Brief/tracker drift: the bullets below this heading, down to WS3c, are WS5a's handoff (misfiled under WS5c). Two-tab model was cheap and is in.
- Status: MERGED. Verifier pending.
- VERIFIER: WS5c — PASS WITH GAPS (fresh clone of `050bbf8`).
  - Reproduced: `pnpm check` EXIT 0 (347 tests); `pnpm proof:sync` EXIT 0 (control passes, 8/8 killed by tagged assertions); main run 44263624582 green; Vercel success on `050bbf8`; the diff touches only `sync.spec.ts` and `scripts/sync-mutants*`.
  - Harness: a kill requires every failing test to fail on a tagged assertion. An injected throw in `acknowledge` came back `crashed`, and the proof exited 1.
  - Verifier mutants: all killed by `[server]` (property plus scripted or batch-limit):
    - undo doesn't bump the revision
    - the server acks all ids but commits only the first 2
    - an undo or amend of a synced record isn't re-queued
  - Reach per 2000 runs:
    - partial commit dropped: 136
    - committed but not acked: 82
    - reload during an in-flight sync: 130
    - two tabs both sending: 124
    - reload with pending records: 160
    - drain checks: 821 plus the final ones
  - Two-tab finding reproduced: tab B returns `failed` (200) with 0 pending and the server holding everything. It happened in 124/124 concurrent sends. No loss.
  - Gaps:
    - `maxLength: 40` is really at most 10 commands (fast-check default size; mean 4.8, about 10% empty), so longer interleavings are never generated.
    - The CI property time on main is 3.2s, not 2.4s.

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
### Sync-diag — production URL_SCHEME_NOT_SUPPORTED — MERGED (env fix still needed, CEO)
- PR #14 → `c398a9e` (head `a736117`). PR CI 44261547643 and 44261889230: all green. Main 44262186877: success. Vercel production: success.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/sync-diag` (316 tests, over `7f9a0cc`). The log is a PR comment.
- `@libsql/client@0.18.0` web, probed:
  - `libsql://`, `https://` and `wss://` all work; so does a `?tls=1` or `?authToken=` query. The client maps `libsql:` to `https:` itself.
  - Quotes, whitespace, a bare host, or `NAME=value` give `URL_INVALID`, not this error.
  - `URL_SCHEME_NOT_SUPPORTED` needs a value shaped `<letters.+->:…` with any other scheme.
- Change:
  - `#lib/server/db/url.ts`: `normalizeDbUrl` trims and strips one pair of quotes, for both TURSO values.
  - `urlScheme` is an allowlisted scheme name, or `memory|missing|quoted|none|other`, so it never leaks a host.
  - Health adds `urlScheme` when the status is `unmigrated` or `error`. A ready response is unchanged.
- **Production after merge:** `{"token":true,"database":"unmigrated","reason":"LibsqlError URL_SCHEME_NOT_SUPPORTED","urlScheme":"other"}`.
  - The value's scheme is none of libsql, http(s), ws(s), file or postgres-like. It's a mistyped or foreign scheme (e.g. `libsq:`, `turso:`, `sqlite+libsql:`) or a label prefix such as `url:`.
  - Turso hosts contain digits, so a bare `host:port` can't be it.
  - **HALT, CEO:** set `TURSO_DATABASE_URL` (Production) to exactly the `libsql://<db>-<org>.<region>.turso.io` URL from Turso's dashboard or `turso db show --url`, then redeploy.
- Gotcha: #13 merged between my rebase and my merge. It's unrelated (a data build), and main CI on the combined sha is green.
- Status: MERGED.

### WS3c — residual data-build gaps — MERGED
- Handoff (ws7b-impl): PR #13, squash-merged as `03dceaf`. Head `47b78ba`. Branch deleted.
- CI: PR run 44261834040 green (typecheck, lint, unit, policy incl. the drift step, e2e, evidence). Main run 44262119910 success. Vercel production success on `03dceaf`. Production 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws3c` at `47b78ba` over `7f9a0cc` (298 tests). `pnpm data:build` gives zero diff, and the byte test passes. Logs are PR comments.
- Reviews: none, 0 threads.
- Decisions:
  - set_details must be a JSON array of objects (a float, an array or a number element is rejected), via `setDetails()` in data-build.ts.
  - score_type lookup is a `Map`. `toString`, `constructor` and `__proto__` fall back to `text`.
  - `parsePythonJson` names its origin for syntax errors (covers `NaN`), for non-finite numbers (`1e999`) and for unsafe integers. The unsafe-integer check moved from output time to parse time.
  - A curated score that isn't a string throws, naming the record.
  - A SugarWOD date error reads `sugarwod#rowN date: "…" is not a m/d/Y date`.
- Tests: mutation proof in the PR body, 9/9 guards killed.
- Brief errors: none. The coordinator's resume note said WS3c wasn't implemented yet; it already was, with PR #13 open.
- Status: MERGED. Verifier pending.
- VERIFIER: WS3c — PASS 4/4. Raw-text fixtures: non-array/non-object set_details (8 shapes), malformed JSON, NaN, 1e999, unsafe ints (snapshot and set_details), numeric curated score and bad dates all throw naming the origin, and the CLI exits 1. toString/constructor/__proto__/hasOwnProperty fall back to `text`. Nit: snapshot/curated parse errors name the file, not the record inside it. `data:build` byte-identical. `pnpm check` EXIT 0 on a fresh clone (b846aaf, 344 tests). Runs 44261330700 and 44262119910 green, Vercel success on both SHAs, no trailers, no `data/` change in either merge.
- (1) A set_details value that is valid JSON but not an array is silently dropped; make it loud.
- (2) The score_type lookup hits the prototype (`toString`); use an own-key lookup.
- (3) Loud errors that don't name the source record should attach the origin.
- Accepted: fail-open movement tagging, title/score_type whitespace variants (these surface in REPORT's unparsed/untagged lists).

### Fixture cleanup (fold into the debate output)
- week-01.json: hard days and Monday TM 265/AMRAP don't match the plan. The notes repeat the structured sets, so drop the duplicate notes. The real plan JSON from the debate replaces the fixture.

### WS5b — log UI — VERIFIED (PASS WITH GAPS 2/2 + HUMAN; the e2e proves the ack, not storage, and WebKit's select is unstyled. Both are folded into WS5d)
- Type: impl EM (ws5b-impl). Doc: ws-05-logging-sync.md (the log UI and the UI e2e). Depends: WS4 (Start seam), WS5a (store, outbox).
- PR #12, squash-merged as `2d3f61f`. Head `8c451d5`. Branch deleted.
- CI:
  - PR runs 44230526746 (e2e red: a WebKit test-order bug, see gotchas), then 44261014714, 44261427724, 44261800750 and 44262136918 (final head): all green (typecheck, lint, unit, policy, e2e 34/34 = 17 tests × mobile-webkit + mobile-chromium, evidence).
  - main: 44262422906 on `2d3f61f` was cancelled (superseded in the concurrency group); 44262424688 on the tip `d6959ad`, which contains it, succeeded. Vercel success on `2d3f61f`.
  - Production `/`, `/log/2026-12-07` and `/sync` return 200, and Start is live.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws5b` at `8c451d5` after the final rebase onto `7f9a0cc` (298 unit tests). Logs are PR comments.
- Reviews: none, 0 threads. Codex has still never posted.
- Public API (all in `#lib/features/log/`):
  - `steps.ts`: `logSteps(session)` → `LogStep[]` (percentSets and fixedSets only, in plan order), `stepTitle`, `repsTarget`, `nextLabel`, `loggedAt(steps, records)`.
  - `flow.svelte.ts`: `LogFlow`, the state machine (resume / less / more / done / undo / advance), with injected store, clock and rest memory. No effects or timers.
  - `rest.ts`: `restSeconds` (90), `rememberedRest` / `rememberRest` (localStorage `golden-hour.rest`, `{sessionDate, entryId, endsAt}`), `restLeftSeconds`, `formatRest`, `wallClock`.
  - `effects.svelte.ts`:
    - `keepSyncing()` is called once in the root layout. It starts WS5a's `startSyncLoop` on app open and on `online`, and tracks `online` / `pending` / `hasToken` / `rejected`.
    - `logSync`, `requestSync`, `useSyncToken`, `restCountdown` (a 250ms interval over the stored end time, vibrating once on finish), `resumeOnOpen`.
  - `effects.ts` adds `persistLocalLog()`: `navigator.storage.persist()` once per load, on the first save, where supported, silently.
  - `local.ts` `localLog()`: one shared `LogStore` handle.
  - `LogSet.svelte` is the screen; `SyncSettings.svelte` is `/sync`.
  - `movement-labels.ts` moved to `#lib/ui/` (now shared by today and log).
- Routes:
  - `/log/[date]` is prerendered from `loadPlan()` entries, so it loads offline from the SW cache.
  - `/sync` is unlinked; `features.yaml` has entries for both.
  - `today.flags.start: true`.
  - `SessionView` takes `startable` and calls `resolve('/log/[date]')` itself; the eslint-disable is gone.
  - Today gets `startable(session)` from the route. That's `logSteps(session).length > 0`, so Start shows on any session with sets, including before the plan (PM ruling).
  - The layout hides the tab bar on `/log*`.
- Decisions, all PM-approved:
  - `/sync` token page. The log header's right slot shows a muted "Offline" or "Not synced" (pending entries and no or rejected token) only when true, linking to `/sync`. "synced" is never shown.
  - Rest is a fixed 1:30, ending at `loggedAt` + 90s.
  - Only sets are logged.
- Other decisions:
  - Reload resumes at the first unlogged set, or on the resting set while its rest is remembered.
  - Undo is `store.undo` (a tombstone that stays pending) and returns to the same set.
  - RPE is a native select (1–10 in steps of 0.5). Note and RPE are saved with the entry, not amended later.
  - A bodyweight set shows "Bodyweight" and no estimated max.
- e2e: `playwright.config.ts` `webServer.env` = `e2e/sync-env.ts` (`SYNC_TOKEN` test value, `TURSO_DATABASE_URL=:memory:`), so sync really runs against the preview server.
- Gotchas:
  - With a fixed clock, all v7 ids share one millisecond, so IndexedDB `getAll` order is random. Sort by set position, not id.
  - The WebKit screenshot caught the `@starting-style` fade part-way. Evidence now waits for `getAnimations()` to finish and opacity 1 before capturing.
  - `svelte/prefer-svelte-reactivity` bans `new Date` in `.svelte.ts`, so the clock is an injected `() => Date` from a plain `.ts`.
  - The production health check (after the CEO's env change) returns `{"token":true,"database":"unmigrated","reason":"LibsqlError URL_SCHEME_NOT_SUPPORTED","urlScheme":"other"}` 503. TURSO_DATABASE_URL still has a bad scheme (CEO, reported to the PM). Until that's fixed, logs stay pending on the phone, which is safe.
- Brief errors:
  - The brief said `/+page.svelte` passes `startHref` to `SessionView`; it passes it to `Today`, which passes it on.
  - An href passed through a prop can't satisfy `svelte/no-navigation-without-resolve`, so the seam became a `startable` boolean.
  - The worktree and branch did not exist yet; I created them.
  - The WS4 e2e "no Start before the plan" was updated, per the PM's ruling.
- Not built: a session-level record (pending CEO). `LogFlow` takes `steps`, so a session step slots in later.
- HUMAN pending: the CEO logs a real set in airplane mode, then enters the token on /sync and syncs, once TURSO_DATABASE_URL is fixed.
- Status: MERGED. Verifier pending.
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
- VERIFIER: WS7b — PASS 5/5. Instrumented fs on the real projects dir: only the projects root, `-Users-jason-Documents` and `-Users-jason-Documents-golden-hour` touched (no `-Users-jason`, `-Users-jason-Documents-Developer` etc.); a fixture tree confirms `-wt-*` read, `-other`/`hourwt-` lookalikes and `-Users-jason` never statted or opened, parent top-level sessions never opened. 10 rejected files: max 8192 B, at most 3190 B past the first cwd record. gh: 13/13 PR sessions have commits; no gh: 0. Running sessions labelled and excluded (totals = finished-only sum). Mutants ancestor scope, bounded read, totals exclusion, commits-from-PR reproduced, all killed.
### WS9 — Evolution 5 plan generator — MERGED
- Type: impl EM (ws9-impl). Source: team/draft-plan.md (Revision 2026-11-18).
- PR #18, squash-merged as `f7d982a`. Head `6cac5dc`. Branch deleted.
- CI: PR runs 44265796051, 44266339021 and 44266846025 (final head) all green: typecheck, lint, unit 391, policy incl. step "plan matches a fresh generate", e2e 38/38, evidence (today-week-1 and today-week-4 inline). Main run 44267305518 success; Vercel success on `f7d982a`.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws9` at `6cac5dc` after the final rebase onto `528f5e7`. Logs are PR comments.
- Reviews: none, 0 threads.
- Public API:
  - `plan/inputs.json` (`PlanInputs`): firstMonday, TMs, `trainingMaxChanges` (week 4/7/11/12/15 × lift → raise|hold|cut; the planned default is raise, and hold at 12), submax pace, tests `{value,date,provisional}` or null.
  - `#lib/domain/evolution.ts`: weekLayout, sessionDate, liftWeek, mainSets, supplementalSets, trainingMaxesFor, mondayFamily/mondayGirl, bikeFamily, qualityB, conditioningScale, longRunMinutes, weeklyRunCap, pullUpSetReps, lSitAccumulation, holiday/retest/checkpoint/deload week sets.
  - `scripts/plan-sessions.ts` `generatePlan(inputs)` → PlanWeek[]; `pnpm plan:generate` writes `plan/week-NN.json` (compact JSON). `loadPlan` globs `/plan/week-*.json`. `plan:check` requires all 17 weeks with names that match their week.
  - The today renderer shows whole minutes as `10 min`, whole mi/km as `1 mi`/`10 km`, and drops the header on a single unrested interval.
- Decisions:
  - Provisional inputs: 10k 53:13, 400 65.42 s, bike 5:06, L-sit 25 s. Null inputs: mile, ring dips, HR max. Their notes use relative text ("half your max", "75% max", "midway between mile and 400 pace").
  - Z1 run minutes are sized so weekly run time is ≤ 1.1 × the last full week (week 0 = 135). Holiday, deload and retest weeks don't reset the base. Tested.
  - Long run: floor(1.1 × 10k) capped at 60, then +5/wk to 90. Deload weeks are 0.8 × the prior week, and the progression resumes after them.
  - The ½ conditioning scale (weeks 1, 2, 7, 11, 15) also applies to Friday bike intervals. Week 11: no FSL. Body comp appears only at the retest (in the submax note), not monthly.
  - Retest: max-effort tests are hard. Body comp and the submax are not.
  - No freeText in work blocks.
- Gotchas: `liftWeek` anchor mapping was caught by a test (weeks 12–14 must be cycle weeks 1–3). Dates are UTC (`addDays`).
- Brief errors: none material. The brief's "test blocks are hard" is applied to max efforts only (see Decisions). ws8-impl asked for a `test?` label on PlanSession; I declined because it is a WS2 contract change that needs PM sign-off.
- VERIFIER: WS9 — PASS WITH GAPS. Independent script (no app imports): all main-lift sets wks 1–15 (TM 215/135/280 → +10/+5/+10 at wks 4/7/11/15, hold at 12; 5's PRO, Anchor 5+/3+/1+, deload 40/50/60, TM test 70/80/90 + 100%×3+; FSL 5×5 Leader, 3×5 Anchor and B-week Fridays, none at deload/TM test), long run, weekly run cap, hard days, calendar, retest table, Girl/Cunningham loads: 0 diffs; the app's rendered loads equal the script's byte for byte. Fresh clone: `plan:generate` diff clean, `pnpm check` 0 (391 tests); main run 44267305518 green; Vercel success on f7d982a; prod `/`, `/week`, `/day/2026-12-07` serve the real plan. Mutants deload %, press step, wk-12 hold, B-week FSL, AMRAP flag all killed. Gaps: §G monthly body comp (wks 1/5/9/13) and wk 4/8/12 ring-dip/L-sit/push-up max checkpoints are not encoded; holiday wks 3–4 lose the pull-up sets with Quality A; set loads round to nearest 5 (WS2 rule; doc only fixes TM FLOOR); deload wks cut run time ~10% (7) and ~12% (15), not 20% (Z1 runs grow to 35); warm-up jogs aren't counted in the +10% rule.

### WS5d — session-level record — MERGED
- Type: impl EM (ws5d-impl). Doc: ws-05-logging-sync.md § WS5d (criteria added unticked). CEO-approved 2026-11-18.
- PR #19, squash-merged as `2534b12`. Head `a4de69d`. Branch deleted.
- CI: PR runs 44307030658 and 44309253156 (final head) all green (typecheck, lint, unit 404, policy, e2e, evidence with session-step, session-score and session-no-sets inline). Main 44309887544 success; Vercel success; `/` 200. Health is unchanged: 503 `URL_SCHEME_NOT_SUPPORTED` (CEO env).
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws5d` at `a4de69d` over `1020121` (404 tests). `pnpm proof:sync`: EXIT 0 on 4 runs: control passes, 13/13 mutants killed by tagged assertions. Logs are PR comments.
- Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/log.ts`: `SessionLog` (`kind: 'session'`, id, sessionDate, `rpe` int 1–10, optional `score {blockIndex, prescriptionIndex, type, value}`, optional note, loggedAt, deviceId), `SessionRecord` (+revision, deletedAt), `SyncRecord = LogRecord | SessionRecord`, `isSessionRecord`. `SyncRequest.records` is `SyncRecord[]`. Schemas are `session-log.json` and `session-record.json`.
  - Store: `saveSession`, `sessions()` (live session records), `stillPending(sent)`. `entries()` still returns only sets. One IDB object store, with no version bump.
  - Server: `session_logs` (`drizzle/0001_session_logs.sql`, CREATE TABLE only), `#lib/server/db/session-logs.ts` (upsert, newer revision wins). Health also requires `session_logs` to be readable.
  - `features/log/session-step.ts`: `scoredPrescription` (the first amrap → rounds_reps, or forTime → time), `defaultSessionRpe` (7 if hard, else 4), `readScore` (parseScore plus rejects seconds ≥60 and reps ≥1000), `clockDigits` (fills m:ss from the right, 4 digits max), `scoreField`.
  - `LogFlow` is now `new LogFlow(session, deps)`. `onSession` means index === steps.length. Adds `sessionRpe`, `easier`/`harder`, `score`, `scoreInvalid`, `savedSession`. The last set's Next reads "Session".
  - Today `startable` is now a boolean: Start shows on every session.
- Decisions:
  - WS5c race fix: an ack that marks 0 is a failure only if a sent record is still pending at its sent revision. `synced` is still returned only when `pending()` is empty.
  - Property: `logSession` commands; `[outcome]` tag (synced ⇒ nothing pending; clean online, concurrent and online undo-during-sync all report synced). `size: 'max'` raises the mean history from 4.9 to 19.3 (max 10 before, 40 now); numRuns goes 2000 → 1000; CI is 6.4s for sync.spec.
  - Mutants added: zero-mark ack is a failure; stillPending ignores revision; the server never stores sessions; a session plain insert; session overwrites a newer revision.
  - Score keyboards: time is `inputmode=numeric` with the digits mask (no colon key on phone keypads); rounds+reps is `inputmode=tel` (for the `+`). Invalid input gets aria-invalid, a muted one-line hint and a disabled Done.
  - Set RPE select: `appearance: none` + glass bg/border, 16px (fixes WebKit's grey).
  - Today/Week logged indicator: none, because no mockup has one (WS8 owns the desktop fill).
  - /sync copy: "N entries waiting to sync" (sessions count too).
  - e2e: the preview server uses a `file:` libSQL DB in a temp dir (`GOLDEN_HOUR_E2E_DB`, set in `e2e/sync-env.ts` before workers fork). `e2e/server-db.ts` reads rows back with `@libsql/client`; set rows and session rows are both asserted. Session tests discover days by structure over the 6 days from `logDate`.
- Gotchas:
  - Local Docker e2e: piping a macOS `tar` adds `._*` AppleDouble files to static/, and the SW precache 404s on them, which shows up as a "SW never controls" timeout. Use `COPYFILE_DISABLE=1` (or `git archive`).
  - `fc.record` objects have a null prototype, and `toStrictEqual` fails on them after a round trip; spread them.
  - `save` was a sync arrow; a ZodError then threw instead of rejecting, so keep store methods async.
  - progress/week WebKit e2e flaked once under local parallel load and passed in isolation; CI was green.
- Brief errors:
  - "distance" isn't a `ScoreType`, so score types are the numeric ScoreTypes (time, rounds_reps, reps, load_lb, seconds, points).
  - The plan has no per-session RPE target, so RPE defaults from `isHardSession` (Seiler bands).
  - Week 8 (ws9 plan) has no scored session without sets, so the score e2e reaches the score field through the sets (Squat + Fran).
- Status: MERGED. Verifier pending. ws8-impl is notified (it derives logged days from `entries()` + `sessions()`).

### WS9b — Evolution 5 plan gaps (WS9 verifier) — MERGED
- Type: impl EM (ws9b-impl). Source: team/draft-plan.md §G, §C (holiday weeks), §F (ceilings).
- PR #21, squash-merged as `d3b5ef2`. Final head `542f90d`. Branch deleted.
- CI: PR runs 44309051931, 44310333790, 44311116437, 44312260566, and 44312963678 (final head). All green on typecheck, lint, unit 428, policy (including "plan matches a fresh generate" and plan:check 17 of 17), e2e 55/55 and evidence (today-week-4-checkpoint and today-week-5-body-comp inline).
- Main run: 44313587826 on `d3b5ef2` failed e2e on both attempts (see Gotchas). The next main run, 44314179954 on `7856664` (the same tree plus one tracker line), succeeded with e2e 55/55, including the two new Today tests. Vercel: success on `d3b5ef2`.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws9b` at `542f90d`, after the final rebase onto `d1a66ae`. Logs are PR comments.
- Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/evolution.ts` adds `bodyCompWeeks` (1/5/9/13), `pushUpLadder`, `Rounding` and `bound(value, 'up'|'down', step)`.
  - `clock(seconds, direction)` now takes a required direction. Sub-minute values show tenths (`0:16.4`).
  - `weekLayout`, `mondayGirl`, `checkpointWeeks` and `qualityB` are unchanged.
- Decisions:
  - Body comp: a 1-min non-hard `warmup`-kind block, "Fasted, before eating: weight · tape". It comes first on Tuesday of weeks 1/5/9/13, the 11/17 baseline weekday (§A2/§A3). The PM approved 1 min, which keeps `Block.minutes` positive.
  - §G checkpoint, weeks 4/8/12: §G names no day, so it goes on Tuesday, in the same session as the submax. The order is §A2's: press → submax → "Gymnastics maxes" (max L-sit, ring dips, push-ups against the 50/75/100 ladder). The maxes replace that day's skill block.
  - The maxes are non-hard, like the weekly pull-up AMRAP, so hard days are unchanged.
  - Push-ups have no baseline. The prescription shows 1 × 50 (the first ladder rung) and the note says max.
  - Holiday weeks 3–4: the pull-up sets move to Wednesday, after the max set, with the moved easy session.
  - Bounds round in the strict direction:
    - "no faster than" paces round up.
    - Pace ranges round inward.
    - HR ceilings floor; range lows ceil.
    - "≥ mi" bike targets ceil to 0.01.
  - Plan changes from the rounding:
    - 100 m 0:16 → 0:16.4.
    - 3 × 10 8:49–8:54 → 8:49–8:53; 4 × 8 8:34–8:49 → 8:34–8:48.
    - Bike 0.39 → 0.40 mi.
    - With hrMax 190, Z1 HR <143 → <142.
  - `plan-grid.ts`: the checkpoint press counts as a `max-l-sit` attempt, so the attempts are weeks 4/8/12/16.
- Reported for the CEO, not changed: set loads round to the nearest 5 (WS2; the doc fixes only the TM floor); deload weeks cut run time ~10% (wk 7) and ~12% (wk 15), not 20%; warm-up jogs aren't counted in the +10% rule.
- Gotchas:
  - Main moved three times during the gate (ws5d, WS8, tracker). The WS8 merge conflicted in today.e2e.ts; both sides were kept.
  - The main run's first attempt failed the untouched "Why this session" test on mobile-webkit; the same tree passed on the PR. The re-run failed the same way. The test opens 2026-12-07, which this PR doesn't change. Likely cause: on iPhone 15 the "Why this session" button sits under the fixed Start button and nav, so the tap can land on Start. This is unconfirmed; flagged to the PM, not fixed here (Today layout is WS4's).
  - Playwright browsers aren't installed locally, so e2e ran in CI only.
- VERIFIER: WS9b — PASS WITH GAPS. 6/6 met. Checked in a fresh clone at `d3b5ef2` with an independent Python script that reads plan/week-*.json and imports no app code, then compared against `d3b5ef2^`.
  - Body comp: Tuesday of weeks 1/5/9/13 only, as block 0 "Body comp", warmup, 1 min, not hard, "Fasted, before eating: weight · tape". No other week 1–15 Tuesday has one.
  - Checkpoint: Tuesday of weeks 4/8/12, in the order Shoulder press → Submax run → Gymnastics maxes (not hard). It holds an L-sit hold, push-ups 1×50 and a note that says max. The old "Gymnastics" skill block is gone. Hard days match the parent on all dates (wks 1–15: 3/wk, holiday wks 3–4: 2) and hard block names match too.
  - Holiday weeks 3–4: Wednesday now has "Pull-ups" 5×6 + ring rows 2×10 after "Pull-up max". The parent had none.
  - Rounding, by my own arithmetic: P10 = 3193/6.214 = 513.84. 3×10 = 528.84..533.84 → ceil 8:49, floor 8:53. 4×8 = 513.84..528.84 → 8:34–8:48. 100 m = 100×65.42/400 = 16.355 → 0:16.4. Bike 60 s / 153 s/mi = 0.392 → 0.40. Ran both trees with hrMax 190: Z1 0.75×190 = 142.5 → <142 (parent <143), range 162–171 and ~171. The diff against the parent shows only these note changes.
  - `pnpm plan:generate` leaves git status clean (byte-identical). plan:check 17 of 17. `pnpm check` EXIT 0 (428 tests).
  - Mutants killed: body comp on wk+1 (3 tests fail), Z1 HR ceiling 'down'→'up' (1 test), Quality A upper pace 'down'→'up' (2 tests), `bound` → Math.round (4 tests). Clone reverted to clean.
  - Gap (not a FAIL): ring dips appear only in the Gymnastics maxes note, with no structured prescription (their baseline is null), so a ring-dip max can't be logged as sets.
  - CEO items as the EM flagged them, not judged: set loads round to the nearest 5; deload cuts are ~10% (wk 7) and ~12% (wk 15) vs the doc's 20%; warm-up jogs aren't counted in the +10% rule.
  - Main CI: 44313587826 on d3b5ef2 failed (flake-diag owns that). Every later main run is green: 44314179954, 44315564318, 44316925911, 44317551134, 44318667295, 44319038990.

### WS5e — sync loop termination + RPE polish — MERGED
- Type: impl EM (ws5e-impl). Closes the WS5d verifier gaps (V3 livelock, select chevron, RPE label).
- PR #22, squash-merged as `6700c94`. Head `d89f52c`. Branch deleted.
- CI: PR runs 44313834520 (first head) and 44316158368 (final head, after the rebase on 1ece847) green (typecheck, lint, unit, policy, e2e, evidence with note-open and session-step inline). Main 44316925911 success on 6700c94.
- Vercel: FAILED, "Deployment rate limited — retry in 24 hours" (the free-tier build limit) on the PR, on main 6700c94, and already on 1ece847 before this merge. Production still serves the last deployed build (`/` is 200). Needs a CEO/PM decision: wait it out or upgrade the plan (that costs money, so not an EM call).
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws5e` at `d89f52c` over `1ece847` (430 tests). `pnpm proof:sync`: EXIT 0 (control passes, 15/15 killed by tags). Logs are PR comments. Reviews: none, 0 threads.
- Public API: `SyncOutcome` adds `{ kind: 'unfinished'; count }`. `sync.ts` exports `roundSlack` (2) and `syncRoundLimit(outboxSize, batchSize)` = ceil(outbox / batch) + 2, taken from `pendingCount()` at call start. `startSyncLoop` treats `unfinished` like any other non-success (backoff retry).
- Decisions:
  - Property `[terminates]` (new tag): each `sync` sends at most ceil(outbox/3)+2 batches, and it never resends the batch it just sent (same ids at the same revisions). An unchanged resend means the round made no progress, so this is what kills V3 now that the bound stops the loop. The bound assertion only bites on a livelock without the bound. The property test timeout is 120s → 30s.
  - Mutants added: V3 "still-pending check treats session records as never pending" → `[terminates]`; "the round limit has no slack" → `[outcome]` (undo-during-sync needs one extra round).
  - Unit `src/lib/features/log/sync.spec.ts`: a writer logs a set during every send, so the sync ends `unfinished` after exactly `syncRoundLimit` sends with 1 still pending.
  - Chevron: two `linear-gradient`s in `--text-muted` (an SVG data URI can't read tokens), padding-right 26px. e2e asserts the computed background-image.
  - Labels: "Effort (RPE)" and "session RPE" both read "RPE" (P3 mockups use "RPE"). Input idioms are unchanged (select vs stepper: a CEO call).
- Not done, by brief (CEO decisions for the morning report): Undo-last-set on the Session step; a one-session-per-date limit.
- Status: MERGED. Verifier pending.
- VERIFIER: WS5e — PASS WITH GAPS (fresh clone of `6700c94`)
  - criteria met: 5/5 (excluding descoped)
    - Termination → `syncOutbox` reads `syncRoundLimit(pendingCount(), batch)` at call start and returns `unfinished` at the limit. `startSyncLoop` retries every non-synced, non-401 outcome with backoff, `unfinished` included. Reproduced: `sync.spec.ts` (a writer logs during every send) passes and ends `unfinished` after exactly `syncRoundLimit(1,1)`=3 sends with 1 pending. With the bound removed it times out at 5s.
    - No-loss proof → `pnpm proof:sync` EXIT 0: the control passes and 15/15 mutants are killed by tags. Own mutants, all killed and then reverted:
      - acknowledge before send: [client], [server], [drain], [tombstone]
      - drop the zero-mark failure guard: [terminates]
      - bound taken from the first batch instead of the outbox: [drain]
    - `[terminates]` vs V3 → the EM's claim holds, but only half of it.
      - With the bound, V3 is caught only by the resend assertion. Removing that assertion lets V3 survive: 4/4 pass.
      - Without the bound, the resend assertion never runs, because it is checked after `syncOutbox` returns. V3 then shows up only as a 30s test timeout, the same failure mode WS5d found.
      - So the bound and the resend check each need the other: the bound makes the livelock end, and the resend check makes it visible.
    - RPE polish → the select has two `linear-gradient` chevrons in `--text-muted`. The e2e asserts the computed background-image matches /linear-gradient/, and both labels read "RPE" (LogSet.svelte:74 and 157). The three-sets e2e passed on mobile-webkit and mobile-chromium in run 44316158368 (55/55).
    - Gates → `pnpm check` EXIT 0 in the clone (430 tests). PR head d89f52c: all CI jobs pass (run 44316158368). Main 44316925911 on 6700c94 succeeded. 0 review threads. No AI trailer.
  - criteria FAILED: none
  - criteria DESCOPED: Undo-last-set on the Session step; a one-session-per-date limit (by brief, CEO for the morning report).
  - criteria HUMAN: whether the chevron reads well on the phone. The e2e proves the gradient is applied, not how it looks; the evidence is the note-open screenshot.
  - UNVERIFIABLE: the Vercel production deploy of 6700c94 ("Deployment rate limited — retry in 24 hours"), an expected rate limit, not a failure.
  - claims that did NOT hold: none on log loss. Nuance: "the no-unchanged-resend assertion is what catches V3" holds only with the bound in place; on its own it cannot catch a livelock.
  - Gaps:
    - (1) No `effects.spec` case drives `startSyncLoop` with an `unfinished` outcome; the backoff was checked by reading the code only.
    - (2) The property's bound is a literal (`/3 + 2`) duplicated from `sync.ts`. That is deliberate, but changing `roundSlack` requires editing the spec too.

### WS8 — desktop planning view — MERGED
- Type: impl EM (ws8-impl). Design: Pass 3 (P3Plan, P3Progress), CEO-approved. Depends: WS4, WS5b, WS6/6b, WS9.
- PR #20, squash-merged as `c1ed16c`. Head `ef8148d`. Branch deleted.
- CI: PR run 44311093535 (final head; earlier heads 44308450925, 44310397931) green (typecheck, lint, unit, policy, e2e 51/51 = 23 tests × mobile-webkit and mobile-chromium, plus 5 on desktop-chromium only; evidence). Main run 44311730052 success on c1ed16c; Vercel success, production / 200 with the desk view prerendered.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws8` at `ef8148d` (422 unit tests, after rebasing on WS5d 2534b12 and e40a18b); the log is a PR comment. Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/plan-grid.ts`: `planGrid`, `columnNames`, `weekSummary`, `testLabel`, `sessionSlot`, `attemptDates`, `nextAttempt`, `trainingMaxByWeek`, `loggedDates`, `phaseName`.
  - `#lib/domain/targets.ts`: `evolutionTargets` (team/draft-plan.md § G End targets; the mile is omitted for lack of a baseline) and `targetPoints`.
  - `#lib/domain/evolution-chart.ts`: `evolutionChart`, `chartX`, `chartY`, `weeksSince`.
  - `#lib/domain/progress-detail.ts`: `benchmarkDetail`, `liftDetail`.
  - `#lib/domain/calendar.ts`: `holidayName` (fixed dates Dec 25 and Jan 1).
  - UI:
    - `#lib/ui/Viewport.svelte` (`only="phone"|"desk"`, `page`) and `viewport.svelte.ts` (`deskMinWidth` 1024, `trackHydration`, `showsView`, `viewport.hydrated`)
    - `DeskNav.svelte`
  - Features:
    - `features/plan/Plan.svelte` and `WeekSummary.svelte`
    - `features/progress/ProgressDesk.svelte` and `EvolutionChart.svelte`
    - `features/log/effects.svelte.ts`: `trackLoggedSessions`, `loggedSessions.dates`
  - `SessionView` gains `nested` (h2 and div instead of h1 and main) and `status`. Its ids come from `$props.id()`.
- Decisions:
  - Breakpoint 1024px, not 768: at 768 the 8-column grid plus the pane leaves about 29px per cell. Tablets in portrait keep the phone column. `layout-breakpoint.spec.ts` asserts the layout CSS equals `deskMinWidth`.
  - No flash: prerendered `/` and `/progress` contain both views, and the CSS picks one. After hydration (a flag set by the layout's `trackHydration`), `Viewport` removes the hidden one. The first client render matches the HTML, so there is no hydration mismatch.
  - The desktop pane renders its SessionView only after hydration. Otherwise the HTML holds the session twice and Playwright `getByText` hits strict-mode violations, which aren't retried.
  - Test labels, phases, scaled weeks (hard in a `conditioningScale < 1` week) and the Progress "Next" week are derived from ws9's `evolution.ts` per session date. No `test?` field on PlanSession: the PM allowed one, but I declined, since "Next" also needs per-test benchmark and lift ids.
  - Column headers: for each weekday, the most common ` + ` title segment (Squat, Press, Threshold intervals, Gymnastics, Deadlift, Long run). A cell whose title lacks its column name shows the title: the holiday-week moves.
  - "Logged" = any live set record for the date (`loggedDates(store.entries())`). It also counts WS5d session records: `store.sessions()` is unioned in, and the desktop e2e seeds one of each kind.
  - Lift chart: dashed TM step line from the plan's percentSets. Benchmark chart: dashed from the last point to the targets. Start = the latest result before the plan; target baselines likewise.
  - Desktop lists have no "All" rows. A deep link to /progress/benchmarks/[id] on desktop shows the phone detail with DeskNav.
- Gotchas:
  - Svelte trims a leading space inside `{#if}` (`min{#if s} · {s}{/if}` renders "min·"). Use an expression.
  - `svelte/prefer-writable-derived` fires on the module `$state` + `$effect` hydration flag. A disable carrying a why sits on the `let`.
  - Local Docker e2e: WebKit link-tap tests (week, progress "All") fail on clean main too. That's a local environment issue; CI is green.
- Deviations from the mockups: hard dots on retest cells (the plan marks them hard); moved-session labels in holiday weeks; the chart adds a two-item key (dataviz) and uses `<title>` tooltips, not a crosshair. Accent vs muted is ΔE 14.9, under the 15 categorical floor, so the dash pattern and direct labels carry identity. Tokens are unchanged.
- Status: MERGED. Verifier pending.
- VERIFIER: WS8 — PASS WITH GAPS. Reproduced: prod / at 390/800/1023 shows phone only and 1024/1440 desk only, both with JS off (CSS) and on (Viewport drops the other); resize 1440→800→1300 swaps; CLS 0 phone, 0.00004 desk. Breakpoint lives only in +layout (min-width 1024 / width < 1024) and deskMinWidth; spec green. No log link visible or present in the desk DOM of / or /progress; desk SessionView is not startable. Independent grid script (plan/week-*.json → hard, scaled wk 1/2/7/11/15, test label by block name, moved title, Dec 25/Jan 1) vs the c1ed16c build and vs current prod: 102/102 cells, 0 mismatches; headers = most common title segment, matching. Targets match draft-plan §G exactly; squat 275 = latest 255 + 20 is right, since §G splits CFT 750 → 800 (+20/+10/+20) on the 11/16 CFT lifts, not bests. Fran start 6:34, best 4:43, Next wk 8; time axes flipped. CI 44311093535: 23 × mobile-webkit, 23 × mobile-chromium, 5 × desktop-chromium (plan.desktop.e2e.ts only), 51/51. Main 44311730052 green; Vercel success on c1ed16c. `pnpm check` EXIT 0 on a fresh clone of d1a66ae (422). PR diff = 25 intended files, no AI trailers. Perf (c1ed16c^ → c1ed16c): / HTML 7.6 → 10.2 KB gz, preloaded JS 74.4 → 81.8 KB gz; fine for phones. Deviations OK: retest hard dots (true to the plan), holiday-move titles, chart key and tooltips. Gaps: (1) wk4 Thu shows only "Mile TT": the deadlift moved from Fri is hidden, because a test label wins over the moved title; (2) unlisted: the pane shows no logged values (the mockup has ✓ reps) and is empty until hydration; (3) the breakpoint spec checks presence only; (4) the pre-start Progress kicker reads raw ISO "starts 2026-12-07"; (5) the Wed header truncates to "Threshol…" with the pane open.

### WS8b — desktop polish (WS8 verifier gaps) — MERGED
- Type: impl EM (ws8b-impl). Source: the WS8 VERIFIER gaps 1–5 plus the pane pop-in.
- PR #23, squash-merged as `31fb8cc`. Head `ee0be77`. Branch deleted.
- CI: PR run 44316840133 on `2c6345f` was red. 2 desktop e2e tests failed because, with Linux fonts, "Gymnastics" overflowed the ~65px left beside the weekday. Run 44317849791 on `ee0be77` was all green (typecheck, lint, unit, policy, e2e, evidence). Main run 44318667295 on 31fb8cc: typecheck, lint, unit and policy green; e2e was still running at handoff. Vercel: rate-limited (PM gate change: don't wait for it).
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws8b` at `ee0be77` over `b431ab6` (439 unit tests). The log is a PR comment. Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/plan-grid.ts`: `GridDay.label`, the cell text. It is the test, then the moved session, joined with " · ", or else the holiday. `GridDay.moved` is now the column name the session came from, not its title. `columnHeader(name)` keeps the words that fit in 10 characters.
  - `#lib/domain/log.ts`: `DayLog` and `dayLog(records, date)`. `sets` are in logged order; `session` is the latest session record.
  - `features/today/prescription-lines.ts`: `Line.at` (`prescriptionIndex` and `setIndexes`) and `loggedText(line, blockIndex, log)`. Set lines show "✓ 5" or "✓ 5/5/5/5/5". The score goes on the first line of the scored prescription.
  - `loggedSessions.on(date)` in `features/log/effects.svelte.ts`. SessionView and BlockRow take an optional `log`. Only the desk pane passes it, so the phone `/day` view is unchanged.
- Decisions:
  - Holiday cells:
    - wk 4 Thu reads "Mile TT · DL".
    - wk 3/4 Wed read "Gymnastics"; wk 3 Thu reads "Deadlift".
    - Retest weeks keep their test labels alone.
    - Beside a test, a moved main lift uses a typed `Record<MainLift, string>` short name. "DL" is the plan's own abbreviation.
  - Header: derived short name plus the weekday stacked above it, which gives the name about 97px at 1440 with the pane open. Type sizes are unchanged. The shorter name alone passed locally but failed with CI's fonts.
  - The pane status line adds "· RPE n" from the session record.
  - `layout-breakpoint.spec.ts` fails on any width query in `src` (`@media`, `MediaQuery(`, `matchMedia(`) outside this set: +layout's 768, 1024 and `width < 1024`, and the `deskMinWidth` template in viewport.
- Gotchas:
  - Local e2e runs without Docker if you point Playwright at the cached chromium_headless_shell-1243 through `launchOptions.executablePath` in a throwaway config.
  - Text widths differ between macOS and CI, so leave real slack in no-truncation asserts.
- Follow-up candidates:
  - Pane pop-in: descoped by the PM. Prerendering the pane duplicates the pre-plan session text in the HTML. Playwright `getByText` matches hidden nodes and doesn't retry strict-mode violations, so every mobile spec would race hydration. Fixing it needs hydration waits in every spec.
  - At 1024–1280px with the pane open, cells and headers still truncate (as before).
- Status: MERGED. Verifier pending.
- VERIFIER: WS8b — PASS WITH GAPS. criteria met 5/6 (1 DESCOPED) + 1 HUMAN. Fresh clone at 31fb8cc. (1) An independent label dump over plan/week-*.json gives: wk3 Wed "Gymnastics", Thu "Deadlift", Fri "Christmas"; wk4 Thu "Mile TT · DL", Wed "Gymnastics"; wk8 and wk12 Fri "Mile TT". Weeks 16 and 17 are identical to 31fb8cc^. Locally, desktop e2e ran 8/8 against chromium_headless_shell-1243 at 1440, and its no-`.trunc`-overflow assert passed over the whole grid with the pane open. (2) e2e checks "Logged · RPE 8", "✓ 6:52" on the scored line, "✓ 5" per set and "✓ 5/5/5/5/5" on the collapsed line, and that an unlogged day shows no ✓. CI evidence plan-pane-logged.png shows the same. Only `/` (the desk pane) passes `log`; Today.svelte and /day don't. Mobile e2e is green in main run 44318667295 (58 passed). (3) Read the built output: prerendered progress.html has "Evolution 5 · starts Dec 7". Also checked a live preview after hydration with an ad-hoc Playwright probe (since removed): "Evolution 5 · starts Dec 7". (4) The header reads "Threshold", with title="Threshold intervals" asserted in e2e. tokens.css is not in the diff. The only added font-size (14px, on .logged) was already used in BlockRow.svelte at 31fb8cc^. (5) Adding `@media (min-width: 900px)` to Plan.svelte makes layout-breakpoint.spec fail and name the query; reverted. Mutations, all caught and reverted: label = test ?? moved ?? holiday → unit "cell labels" plus e2e holiday test; headerChars 30 → unit columnHeader; the header renders {name} → e2e headers + holiday truncation; reps.at(-1) instead of join('/') → unit loggedText plus e2e "✓ 5/5/5/5/5"; scored = true → unit score test. Unit 439/439. PR run 44317849791 green on ee0be77; main 44318667295 all jobs green (evidence skipped on main). 0 review threads, no AI trailers. DESCOPED: (6) pane pop-in, by PM ruling (it races hydration; see WS8b follow-ups). HUMAN: (4) the weekday now stacks above the column name, which deviates from the P3Plan mockup. Known gap, not a failure: cells and headers still truncate at 1024–1280 with the pane open. Claims that did NOT hold: none.

### Flake-diag — "Why this session" mobile-webkit failure on d3b5ef2 — MERGED
- Type: diag EM (flake-diag). Branch `fix-fixed-overlap`.
- PR #24, squash-merged as `f53140e`. Final head `a032f6d`. Branch deleted.
- CI:
  - PR run 44362736701 (head `95ca93e`): e2e passed 70/70 on attempts 1, 2 and 3. Evidence was red on attempts 2 and 3 (a same-SHA re-run bug, fixed in this PR).
  - PR run 44364798225 (head `a032f6d`): all green on attempts 1 and 2, e2e 70/70 each.
  - Main run 44366280301 on `f53140e`: success, e2e 70/70.
  - Vercel: rate-limited (PM: don't wait).
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/flake`, rebased onto `65a33d2`, a tree identical to `a032f6d` (442 tests). Logs are PR comments.
- Reviews: none, 0 threads.
- Root cause: a tap on prerendered HTML before hydration.
  - Evidence: run 44313587826 logged `expect(getByText('Leader block…')).toBeVisible()` → "element(s) not found" after a click that succeeded. There was no interception and no /log navigation. CI had no trace (traces are off and only screenshots are uploaded).
  - Local Playwright Docker (v1.65.1), 40 repeats on mobile-webkit: 2 failed. In both, `[data-view="desk"]` was still in the DOM at click time, so the page wasn't hydrated yet.
  - The fixed-overlap hypothesis is false. Start is in normal flow, not fixed. The shell's padding (tab bar + 12px) plus the body's `safe-bottom` padding clears the bar, which is 52px + max(safe-bottom, 8px) tall. The week-4 "overlap" is the known full-page screenshot artifact (WS4 gotcha).
- Changes:
  - `viewport.svelte.ts` `trackHydration` sets `<html data-hydrated>`. `e2e/test.ts` exports a `test` whose `page.goto`/`page.reload` wait for it (on an ok or null response). eslint `no-restricted-imports` bans importing `test` from `@playwright/test` in `e2e/**`.
  - Playwright `use.serviceWorkers: 'block'`. `log.e2e.ts` and `pwa.e2e.ts` opt back in with `test.use({ serviceWorkers: 'allow' })`.
  - Regression tests:
    - today.e2e "a tap right after opening, while the app is still starting, is not lost" delays `entry/app.*.js` by 1.5s. Against the old harness it failed 2/2 (webkit and chromium).
    - `e2e/fixed-ui.e2e.ts`: for `/`, `/week`, `/day/2026-12-08`, `/progress` and a lift history, the page is scrolled to the end, and its bottom-most visible element must be hit at its centre and end above the tab bar. Mutant (shell padding → 12px): 6/10 failed (Start, All lifts, SugarWOD profile). /week and /day are shorter than the viewport, so the mutant doesn't reach them.
  - `vercel.json` `ignoreCommand`: `git diff --quiet HEAD^ HEAD -- . ':(exclude).sprint' ':(exclude)team' ':(exclude)profiles' ':(exclude)prompts'`. Vercel's docs say exit 0 skips and exit 1 builds. `scripts/vercel-ignore.spec.ts` runs it in a temp repo: a docs-only commit skips, a code+docs commit builds, a root-file commit builds. Against the real history, 7856664→1ece847 (tracker-only) exits 0. The `ci-evidence` branch's own vercel.json is untouched.
  - ci.yml evidence: `git diff --cached --quiet || git commit`, so a same-SHA re-run with identical screenshots no longer fails on "nothing to commit".
- Gotchas:
  - Waiting for hydration exposed a second hidden race. Progress taps ("All benchmarks", "Back squat", "All lifts") used to pass only as native navigations before hydration. After hydration, the client navigation's `__data.json` stayed pending more than 5s on WebKit while the SW's first install precached 472 prerendered files (~40 MB) through the HTTP/1.1 preview server. Blocking SWs outside the offline specs removes that contention from tests that don't test the SW.
  - Corepack is gone in Node 26. For local Docker e2e, run `npm i -g pnpm@12.21.0` inside the container.
  - Force-push is denied by the auto-mode classifier, so the pre-merge rebase was pushed as a merge of origin/main (same tree as the rebased branch, verified by an empty diff).
- Brief errors: the worktree didn't exist (I created it). Start isn't fixed. No Playwright trace artifacts exist for the failing run. /log has no fixed bottom UI (the tab bar is hidden there), so it isn't in the fixed-UI check.
- Follow-ups for the PM: (1) The SW precache is ~40 MB on first visit, because every prerendered page and its `__data.json` embed the plan. That's costly on cellular and slows first-visit navigation. (2) Real taps before hydration are lost on a cold start. Native `<details>` for the disclosures would make them work before hydration. (3) The e2e has no trace on failure. `trace: 'retain-on-failure'` plus uploading test-results would make the next diagnosis faster.
- Status: MERGED. Verifier pending.
- VERIFIER: flake-diag — PASS WITH GAPS (fresh clone at `f53140e`; tracker checked at `428f325`)
  - criteria met: 7/8, plus 1 HUMAN
  - (1) Root cause → `gh run view 44313587826 --log-failed`: the click at today.e2e:66 resolved with no "intercepts pointer events" and no retry loop. Then `getByText('Leader block…')` → "element(s) not found" for 5s. mobile-chromium passed the same test. This fits a tap that was lost before hydration, not an overlap. Reproduced the mechanism in Docker v1.65.1: with today.e2e importing `test` from `@playwright/test` again, the delayed-entry regression test failed 2 of 4 runs (2 repeats × 2 projects). The EM said 2/2. It catches the bug, but not every time.
  - (2) No assertion weakened → I read the full diff of every e2e spec and of playwright.config. The changes are import swaps, two `test.use({ serviceWorkers: 'allow' })` lines, and two new tests. Nothing removed, no `force`, no `.first()`, no new timeouts, and `retries` is unset both before and after. One thing is loosened by design: every goto/reload now waits for hydration, so no test taps before hydration any more. The new regression test asserts what the harness does, not what the product does (see follow-up 2).
  - (3) Lint fires → changed week.e2e to import `test` from `@playwright/test`: `no-restricted-imports` error, exit 1. A namespace import (`import * as pw`) is caught too. Reverted, and `eslint e2e` exits 0.
  - (4) The mark can't be set early → `trackHydration` sets `dataset.hydrated` inside `$effect` (client only, after mount), and the root `+layout.svelte` calls it. In a local `pnpm build`, none of the 236 prerendered HTML files has `hydrated` on `<html>`. index.html opens with `<html lang="en">`.
  - (6) vercel-ignore → the spec passes 3/3. I ran the real command against this repo's history: f53140e exits 1 (build); 428f325, 65a33d2 and 32ce05c exit 0 (skip). `.sprint`, `team`, `profiles` and `prompts` hold only .md files, plus .sprint/design/*.dc.html and team/panes.txt. There is no src in any of them, and no code reads them at build or run time. The only mentions are comments in targets.ts and strength.spec.ts, and the allowlist in check-md.
  - (7) CI → main 44366280301 on f53140e: success, e2e 70 passed, unit 442 passed, evidence skipped. PR run attempts: 44362736701 had e2e green on all 3 attempts and evidence red on attempts 2 and 3, as described. 44364798225 was green on both attempts. Docker run at f53140e: the regression test, fixed-ui and "Why this session" ran 3 times each on both phone projects, 42/42 passed.
  - (8) Tracker integrity → every line that 32ce05c (WS9b, 10 lines), 86837c2 (WS5e, 21 lines) and 65a33d2 (WS8b, 1 line) added to tracker.md is present verbatim at 428f325. 65a33d2..428f325 only adds lines (+30/−0). f53140e doesn't touch the tracker.
  - criteria FAILED: none
  - criteria DESCOPED: none
  - criteria HUMAN: (5) service-worker coverage. Before this change every spec ran with the SW allowed, because that is Playwright's default. Now these run with it blocked: today (10), week (2), progress (6), plan.desktop (8), and the new fixed-ui (5). Only log (6) and pwa (2) keep it. The pwa test covers Today → Week → Long run with the SW. These paths now run only without a SW:
    - every Progress screen (lists, lift history, benchmarks)
    - the desktop Plan view
    - Today's disclosures

    The EM found a real slow path: a client navigation's `__data.json` is stuck for more than 5s while the first install precaches. That is a real first-visit effect, and the tests now hide it. CEO: is that acceptable?
  - UNVERIFIABLE: none
  - claims that did NOT hold:
    - "fails 2/2 against the old harness": I saw 2/4 failures. It still catches the bug, but not every run.
  - Gaps:
    - The ignoreCommand compares `HEAD^..HEAD` only. A push whose last commit is docs-only but contains an earlier code commit would skip its deploy. That is safe on main with squash merges and single verdict commits, but not on PR preview branches. Vercel's `$VERCEL_GIT_PREVIOUS_SHA` would close it.
  - Observations:
    - (a) The 40 MB claim is confirmed. `du` gives 40M for prerendered: 472 files, 236 HTML plus 236 `__data.json`, 39.1 MB apparent size, of which the HTML is 21 MB. A page gzips about 12× (index.html: 134 KB → 10.7 KB), so the bytes sent are much smaller if the server compresses.
    - (b) Lost cold-start taps on a real phone remain a product gap. No test covers them.
    - (c) There are still no traces kept on failure.

### WS5f — replace same-day session record — MERGED
- Type: impl EM (ws5f-impl). CEO 2026-11-18: "repeating a session on the same day … replacing the previous one."
- PR #25, squash-merged as `0c7a00b`. Head `d80f375`. Branch deleted. One push.
- CI: PR run 44395084716 green (typecheck, lint, unit, policy, e2e 72/72, evidence with session-prefilled inline). Main run 44397419348 success on `0c7a00b`; Vercel success.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws5f` at `d80f375` over `1dc610c` (450 tests). `pnpm proof:sync`: EXIT 0, control passes, 16/16 mutants killed by tags. Both logs are PR comments. Reviews: none, 0 threads.
- Public API:
  - `#lib/domain/log.ts`: `SessionsByDate` (ReadonlyMap date → SessionRecord), `sessionsByDate(records)` (one per date: live over undone, then latest loggedAt), `replaceSession(existing, next)` (same id, revision + 1, next's values; revision 1 when there is none). `dayLog` reads through it.
  - Store: `sessions()` now returns `SessionsByDate` (live only). New `sessionOn(date)` includes an undone record. `saveSession` finds the date's record and writes the replacement inside one readwrite transaction (IDB serialises these across tabs).
  - Flow: the Session step pre-fills RPE, score and note from the date's record. A live record still opens on "Session saved" (unchanged), so in practice a repeat goes through Undo and then Done.
- Decisions:
  - The key is `sessionDate`: PlanWeek allows at most one session per day, so (date, plan session) = date.
  - A save after Undo revives the undone record (same id, next revision, deletedAt cleared) instead of starting a second one. The server's newer-revision-wins upsert clears deleted_at. A replayed old request still can't resurrect it.
  - No IDB unique index: legacy data already holds undone + live pairs for a date (the old Undo → Done path), and an index needs a version-2 upgrade that the open v1 tabs would block. The transaction guard covers the race; a store test saves from two tabs at once and gets one record at revision 2.
  - Legacy extra records stay as they are (never deleted). The date's preferred record is the one replaced.
  - Proof: logSession now spans two dates. New `resaveSession` command (direct, or during an in-flight sync) and a `[replace]` tag (same id, revision + 1, live). Reach per 1000 runs: resave of a pending record ~418, a synced one ~193, an undone one ~156. Scripted history adds a pending (offline) resave, a synced resave and an in-flight resave. The drain test's sessions moved to distinct dates.
  - Mutant "replace creates a new id instead of bumping the revision" is killed by `[replace]` in both the property and the scripted history.
- Gotchas: local Playwright browsers are stale (1243 vs 1255), so the log e2e ran in the `v1.65.1-noble` Docker image from a `git archive` (14/14) before the push.
- Brief errors: "(date, plan session) pair": the record has no plan-session id; the date is the key. "When a record already exists, the Session step pre-fills": a live record opens on the saved view, so the pre-fill shows after Undo (in the flow and on reopen).
- Status: MERGED. Verifier pending.
- VERIFIER: WS5f — PASS. Fresh clone at `0c7a00b` (tree identical to PR head `d80f375`).
  - criteria met: 6/6 testable (+1 HUMAN)
  - (1) replace edits the record → `replaceSession` spreads only `next` (a strict SessionLog with no deletedAt) plus `{id: existing.id, revision: existing.revision + 1}`. `saveSession` uses `put` with pending 1 when there is a record and `add` when there isn't, so nothing is ever deleted. Store spec covers the pending case (rev 2, an ack of rev 1 marks 0) and the synced case (rev 3, back in the outbox). Reproduced in `pnpm check`.
  - (2) Undo then save revives the record → store spec gives the same id at rev 3 with deletedAt gone. Read `upsertSessionRecords` myself: `onConflictDoUpdate` sets every column from `excluded`, deleted_at included (written as null), `where excluded.revision > revision`. A replayed rev 1 or 2 cannot beat rev 3, so it can't resurrect or overwrite. e2e (CI, both projects) shows the server row at rev 3 with deleted_at null.
  - (3) Two tabs, one record → own mutant: read the date's record outside the readwrite tx, then write in a new tx. Killed by store spec "two tabs saving … one record". Reverted. Legacy undone+live dates: `sessions()` filters live first. `sessionOn`/`dayLog`/`saveSession` prefer live over undone, then the latest loggedAt. No delete path exists. Readers: Progress doesn't read session records. The only readers are `loggedSessions.dates`/`.on` (Plan dots, day pane, SessionView) via `dayLog`/`loggedDates`, and `LogFlow.resume`. With undone+live, live is shown. With two live (pre-WS5f double save), the latest is shown, the same as the old `at(-1)`. The logged-dates set is unchanged.
  - (4) proof:sync → EXIT 0, control passed, 16/16 KILLED. "replace creates a new id…" is killed by [replace] in the property and in the scripted history. Own mutants, each reverted: "replace keeps the old revision" is killed by [replace] (2 tests). "replace drops the score" is killed by [client].
  - (5) `sessions()` consumers → git grep finds only effects.svelte.ts (`.values()`), plus specs. flow.svelte.ts moved to `sessionOn`. At 1dc610c there were 3 call sites; all are updated. Nothing that showed a live record now drops it (see 3).
  - (7) Gates → `pnpm check` EXIT 0 locally (47 files, 450 tests). PR run 44395084716 success on d80f375. Main run 44397419348 success on 0c7a00b (evidence skipped on main). The new e2e passed on mobile-webkit and mobile-chromium, 72 passed. 0 review threads, 0 reviews.
- criteria FAILED: none
- criteria DESCOPED: none
- criteria HUMAN: (6) What the user sees: reopening a day whose session is logged lands on "Session saved" (RPE · score) with Undo. To repeat: tap Undo. The saved card goes and the fields keep the previous RPE, score and note (and are pre-filled on reopen). Adjust, then Done: the same record is now rev +2. Caveats for the CEO:
  - (a) Between Undo and Done the day is unlogged. Leaving at that point leaves it undone.
  - (b) Only the session record is replaced. A day's set steps that are already logged are skipped on reopen, and the flow has no way back to re-log them.
- UNVERIFIABLE: local e2e (stale Playwright browsers), so the CI job logs are the evidence.
- claims that did NOT hold: none

### WS11a — test-harness hygiene — MERGED
- Type: impl EM (ws11a). Not a hold chunk. PR #26, squash-merged as `51c9f04`. Heads: `92053ad`, then `ca81e67`. The PR branched from `c4b77cb`, and main never moved, so no rebase was needed. Branch deleted.
- CI: PR run 44399877640 (`92053ad`) was green, but the Vercel preview FAILED there (see the gotchas). PR run 44401196003 (`ca81e67`) was green on all jobs, and the preview built. Main: run 44403376469 on `51c9f04`, success (typecheck, lint, unit, policy, e2e; evidence skipped on push); Vercel production "Deployment has completed", `/` 200.
- `pnpm check`: EXIT 0 on `/Users/jason/Documents/golden-hour-wt/ws11a` at `ca81e67` over `c4b77cb` (458 tests). `pnpm proof:sync`: EXIT 0, control passes, 16/16 killed. `pnpm e2e:local`: 72 passed in 1.7m. All logs are PR comments. Reviews: none; 0 threads.
- Public API:
  - `pnpm e2e:local` → `scripts/e2e-local.ts`, with exports `ciPlaywrightImage(workflowYaml)`, `pinnedPnpm(packageJson)` and `dockerArgs(image, pnpm, repo, tty)`.
    - It reads the image from `ci.yml` `jobs.e2e.container.image`.
    - It runs with `CI=true HOME=/root --ipc=host` and mounts the repo at /work.
    - It masks `node_modules`, `.svelte-kit`, `.vercel` and `build` with anonymous volumes, so host installs are untouched.
    - `test-results/` (traces) comes back to the host.
    - With no Docker, it exits 1 with one line.
  - Playwright `trace: 'retain-on-failure'`. CI step `if: failure()` uploads `test-results/` as `e2e-traces` (7 days).
- Decisions:
  - The spec `scripts/e2e-local.spec.ts` pins the CI image tag to `v${installed @playwright/test}-noble`. A bump to one side without the other then fails unit, not e2e: the stale 1243-vs-1255 browser class.
  - Vercel ignoreCommand: `b=${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}`, then build when `git cat-file -e "$b^{commit}"` fails, else `git diff --quiet "$b" HEAD -- . ':^.sprint' ':^team' ':^profiles' ':^prompts'`. Any error is mapped to exit 1 (build).
    - Per the Vercel docs, VERCEL_GIT_PREVIOUS_SHA is "the last successful deployment for the project and branch", empty on a branch's first deploy, and exposed only when an Ignored Build Step is set. A canceled (ignored) deploy is not a successful one, so a docs-only push doesn't advance the base. A rate-limited failed deploy doesn't either, so the next push still sees its code.
    - New spec cases:
      - code-then-docs builds (fails against the old command)
      - multi-commit docs-only skips
      - an unknown base builds
      - the command is ≤256 characters
  - `effects.spec`: "backs off after an unfinished sync and retries until it succeeds". A writer logs during every send, so the outcome is `unfinished`. Then: 1 timer pending; nothing fires before `retryDelayMs(0)`; at the delay it ends `synced` with 0 pending and 0 timers. Treating `unfinished` as done fails this test (checked by mutating `effects.ts`).
  - The property bound is now `syncRoundLimit(pendingCount, batchSize)`, with `batchSize = 3` named once.
- Gotchas:
  - vercel.json `ignoreCommand` has a schema `maxLength` of 256. At 273 characters the deploy failed with only "Deployment failed", and the status linked the project-configuration docs. That is now a unit test.
  - Vercel docs: canceled (ignored) builds still count toward the deployment quota, so ignoreCommand saves build minutes but not deploy slots.
  - Local `pnpm check` once timed out at 5s in `lint/config.spec.ts > $effect placement > fails in a feature component` under load. The rerun was green. A possible flake candidate.
- Brief drift: none material. The brief said "import syncRoundLimit (or roundSlack)"; I used `syncRoundLimit`.
- Status: MERGED. Verifier pending.

### CLOSE — Stage 5′ — DONE (awaiting CEO HUMAN checks)
- 2026-11-18 PM close: every chunk is merged and has a verifier verdict, with no FAIL (flake-diag verdict c7063e1).
- main is green: run 44366280301 on f53140e passed e2e 70/70 and 442 unit tests.
- Production serves f53140e, and `/api/sync` returns {token:true, database:ready}. Vercel's ignoreCommand skipped the docs-only build for 428f325.
- `pnpm sessions:score` covered 44 sessions, about 53 hours, about 2.2k tool calls, 54 failed and 20 retried.
- The morning report is at https://claude.ai/artifact/QMkA4UihUVjfW9ESuPXaDa and covers decisions 1–14, the follow-ups and the verification ladder.
- `.sprint/` is kept until the CEO finishes the HUMAN phone checks; then delete it, per the docs policy.
- Runner: the full mobile e2e suite on the final `main` tip.
- `pnpm sessions:score` over all sprint sessions → turn the findings into checks.
- Delete `.sprint/`, then write the morning report.

### Follow-up candidates (PM, collected for the morning report)
- WS6b:
  - The lift-rule window is relative to the build date, so a non-main 1RM silently drops off on a rebuild about 3 years later. Pin it to a data-relative date, or accept that.
  - Nothing ties `testBattery` to the plan's non-catalog tests (ring dips, submax, mile TT, body comp).
  - The conflict note is internal jargon ("Evo2 test week") and sits on the wrong row.
- WS5b: the RPE select on WebKit, and the server read-back in e2e. Both are folded into WS5d.
- WS5c: the property's history length cap is folded into WS5d. Never modelled: a second device, clock skew, and startSyncLoop itself.
