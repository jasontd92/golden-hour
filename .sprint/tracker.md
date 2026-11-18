# Golden Hour app v1 — execution tracker

> Single source of truth for the multi-session PM/EM rotation. Append-mostly. Every iteration checks §1 against reality first (git, gh, worktrees).
> Pattern: `/sprint` (boilerplate-skills/skills/sprint), INDEPENDENT shape. Definition and design: `.sprint/README.md`. Workstreams: `.sprint/ws-NN-*.md`.
> **PM resuming after a compaction:** load the `sprint` skill, then read this file §1–§3, then README.md. Don't re-ask the CEO anything recorded here.

## §1 Active state
- Stage: 3 in progress. 2026-11-17: CEO "go for the sprint, complete end to end"; Turso credentials are saved in Vercel env.
- Shape: INDEPENDENT PRs to `main`. All work is additive; a half-shipped state is survivable.
- Ground truth: GitHub PR state (`gh pr view --json state,mergeStateStatus,statusCheckRollup`) plus GraphQL review-thread counts.
- Repo: github.com/jasontd92/golden-hour (private). Base `origin/main`; re-query the tip with `git rev-parse origin/main`.
- Base health: no CI yet (WS1 creates it).
- Vercel: connected. Turso: DB created, credentials in Vercel env (CEO, 2026-11-17).
- Codex review: CEO enabling async. Not a blocker.
- Open PRs: none. Live worktrees: none. Live subagents: ws1-impl (impl EM, main checkout branch).
- Merged + verified: none.
- Parallel track (not an EM chunk): Evolution 5 coaches debate, PM-moderated with the CEO. Starts after WS2 merges, since its output is `PlanSession` JSON. First agenda items:
  1. Does the 2–3 hard-sessions cap apply to running quality only, or to metcons too? PM recommendation: running only.
  2. What replaces Kong is King (lost) in the test battery?
- Next chunk: WS1.

## §2 CEO directives (durable — read every iteration)

### Product
- Single user, phone-first PWA, web-enabled. No auth, not a product; multi-user is a future refactor.
- Design v0 approved (after the vuca.dev theming): README § Design. Simple and elegant, progressive disclosure, nothing verbose on screen.

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

### WS1 — scaffold + guardrails + CI — NOT STARTED
- Type: impl EM, serial. Doc: ws-01-scaffold.md.

### WS2 — domain contract — NOT STARTED
- Depends: WS1. Doc: ws-02-domain.md.

### WS3 — data build port — NOT STARTED
- Depends: WS2. Hold-the-line B. Doc: ws-03-data-port.md.

### WS4 — shell, PWA, Today, Week — NOT STARTED
- Depends: WS2. Doc: ws-04-shell-today-week.md.

### WS5 — logging + offline sync — NOT STARTED
- Depends: WS2 (data layer); WS4 (UI mount). Hold-the-line A. Doc: ws-05-logging-sync.md.

### WS6 — progress — NOT STARTED
- Depends: WS3. Doc: ws-06-progress.md.

### WS7 — agent-session scorer — NOT STARTED
- Depends: WS1. Doc: ws-07-session-scorer.md.

### CLOSE — Stage 5′ — NOT STARTED
- Runner: the full mobile e2e suite on the final `main` tip.
- `pnpm sessions:score` over all sprint sessions → turn the findings into checks.
- Delete `.sprint/`, then write the morning report.
