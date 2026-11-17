# Golden Hour app v1 — sprint tracker

> Working memory for the PM across compactions. Append-mostly. Verify §1 against reality each iteration.
> Pattern: boilerplate-skills/skills/sprint (Independent shape). This folder is deleted at program close; durable decisions become schemas, lint rules or tests.

## §1 Active state
- Stage: 0 — design front-loaded (mockups → v0 sign-off) before engineering
- Shape: INDEPENDENT PRs to main (all work is additive)
- Repo: github.com/jasontd92/golden-hour (private), main @ 338fba7
- Vercel: NOT connected yet (repo not visible in Vercel import → Vercel GitHub app likely needs repo access)
- Codex review: not confirmed
- Open PRs / worktrees / subagents: none
- Next: design mockups artifact → CEO picks v0 direction

## §2 CEO directives (durable)
- Stack: SvelteKit + TypeScript, installable PWA (no Apple dev license). Web-enabled, phone-first. Single user; no auth; don't productize.
- Data: logs offline-first on phone, synced to hosted DB. PM recommends Turso (SQLite) + Drizzle; CEO has no DB preference.
- Merge: auto-merge when green. Gate = CI green + Codex review present on latest SHA + 0 unresolved threads (Codex posts comments, not a check → EM enforces, not GitHub auto-merge).
- AI review is the first backstop, not the goal: every finding asks "could a type/lint/test have caught this?" → ship that check. Findings/PR is a tracked metric.
- Pattern source: Lauren Tan "All Code Is Slop (Except Mine)": lint > prose, ~no comments, minimal agent-facing markdown, feature map, runtime verification with screenshots.
- Front-load design: mockups before v0, then PM runs with it.
- Docker is available if useful.
- Programming debate (Evolution 5) runs in parallel, moderated by PM; it writes into the WS2 PlanSession format.
- Commits: conventional, NEVER an AI co-author trailer, `git add <paths>` never -A.

### Verification posture
Blast radius: one user's broken page. Default ship-and-observe. Hold the line on: (A) no log entry ever lost (interrupted+replayed sync test), (B) TS data port output identical to build.py, (C) main green + deploys.
Explicitly cut: TLA+/Lean, auth/multi-user, browsers beyond mobile Safari + mobile Chromium.

## §3 Workstreams (draft, pending CEO sign-off after design)
- WS1 scaffold + guardrails (first, serial)
- WS2 data contract: Workout, Result, PlanSession, LogEntry schemas
- WS3 port build.py → TS with parity test
- WS4 Today screen + PWA shell
- WS5 offline logging + sync (Turso)
- WS6 history: benchmarks, lift maxes, trends
- WS7 agent-session scorer (any time)
- Close: full mobile browser suite on main + morning report
