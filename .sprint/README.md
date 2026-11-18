# Golden Hour app v1 — sprint definition (Stage 0, CEO-approved 2026-11-17)

Temporary. Deleted at program close (Stage 5′). Durable decisions end up as code: tokens, schemas, lint rules, tests.

## Scope
A phone-first, installable web app (PWA) for one athlete, plus the agent-first repo machinery around it. It shows today's session, logs sets offline and syncs them, and shows progress from the training-history data in `data/`. There's no auth and no multi-user support, and it isn't a product.

Out of scope for v1: generating the program itself. The Evolution 5 coaches debate runs in parallel, moderated by the PM, and writes `PlanSession` files that WS2 defines. Until that output exists, the app reads one placeholder week (the week shown in the mockups).

## Resolved decisions
| Decision | Choice | Why |
|---|---|---|
| Framework | SvelteKit + TypeScript (strict) | CEO wants to learn it; small bundles on a phone; Vercel adapter |
| Distribution | PWA, home-screen install | No Apple developer license |
| Data contract | zod schemas in `src/lib/domain`, shared by build script, app and debate output | One definition validated everywhere |
| Storage | IndexedDB on the phone first, synced to Turso (libSQL) through Drizzle | Offline at the gym; dev/test DB is a file, so CI has no infra |
| Hosting | Vercel, preview per PR, production on `main` | Already connected |
| Merge | EM merges when CI is green, Codex review is present on the head SHA (once Codex is enabled) and there are 0 unresolved threads. GitHub auto-merge stays off. | Codex posts comments, not a check |
| Review philosophy | AI review is the first backstop. For every finding ask: could a type, lint rule or test have caught this? If yes, ship that check in the same PR. | Findings per PR should trend to zero |
| Prose policy | No comments except a rare why-comment for non-obvious intent. Markdown only on an allowlist. Code documents itself through names and directories. | Stale prose anchors agents (Lauren Tan talk) |
| Toolchain | pnpm (not installed on host yet: `npm i -g pnpm`), Node 26, Docker available | |
| Repo layout | SvelteKit at repo root. `data/`, `team/`, `profiles/`, `prompts/`, `bin/` stay where they are (methodology content, outside the app). | Minimal churn; bin scripts reference these paths |

## Design (v0, approved after the vuca.dev theming)
Reference mockups: `.sprint/design/P2*.dc.html` (live canvas: https://claude.ai/artifact/VAMdGRd2S13J3HBGDoPCDs, page "Pass 2"). They're design reference, not code to port.

**Principle.** One thing at a time, details on tap. Surface only what matters now. Avoid the LLM failure mode of dense, verbose screens.

**Tokens (from vuca.dev, dark only).**
- `--bg-base: #06090b`, `--bg-glass: #ffffff0d`, `--border-glass: #ffffff1a`
- `--text-primary: #eef4f3`, `--text-muted: #93a3a1`
- `--accent: #2fd8c6`, `--accent-2: #2aa9c9`
- `--radius: 16px`, `--blur: 16px`
- Fonts: Geist (300–700); Geist Mono (400–600) for numbers (loads, reps, times). Headings weight 650, letter-spacing -0.02em. Body near 0.
- Focus ring: `2px solid var(--accent)`, offset 3px.

**Motion and touch (Emil Kowalski: emil-design-eng, mobile-native, apple-design).**
- Press: `scale(0.97)` on `:active`, 140ms `cubic-bezier(0.23, 1, 0.32, 1)`. No animation on high-frequency actions. State swaps go under 250ms, ease-out, via `@starting-style`.
- Mobile baseline: `viewport-fit=cover`, safe-area insets, `100dvh`, 16px inputs, `touch-action: manipulation`, no tap highlight, `overscroll-behavior: none`, `user-select: none` on controls only, hover gated on `(hover: hover) and (pointer: fine)`, `theme-color` matching `--bg-base`.
- Respect `prefers-reduced-motion`.

**Screens.** Bottom tab bar (translucent) with Today, Week and Progress.
1. **Today:** day name, session title, total minutes. Block rows show name and minutes, with an accent dot on hard blocks. Tap a row to expand its prescription (sets, movements, loads). A "Why this session" disclosure. A primary Start button.
2. **Logging:** set context (lift, set n of m), the big target load, and a rep stepper defaulting to the minimum reps. Done saves. After Done, show reps saved, the estimated 1RM (Wendler: w × r × 0.0333 + w) and the rest countdown. Then "Next: …" and Undo. Note and effort live behind "Add a note". The offline indicator shows only when offline.
3. **Week:** seven rows (day, session name, hard dot). Today is highlighted and Sunday is Rest. No totals.
4. **Progress:** two short lists, Benchmarks and Lifts (1RM), each showing only the best. Tapping a row opens its history (v1: a simple list of results with dates).

## Workstreams (Independent shape, dispatch order)
| WS | Name | Depends on | EM type |
|---|---|---|---|
| 1 | Scaffold + guardrails + CI | — | impl (serial; touches every shared file) |
| 2 | Domain contract (schemas) | 1 | impl |
| 3 | Data build port (Python → TS, parity) | 2 | impl |
| 4 | App shell, PWA, Today + Week | 2 | impl |
| 5 | Logging: offline-first + Turso sync | 2 (4 for UI mount) | impl |
| 6 | Progress | 3 | impl |
| 7 | Agent-session scorer | 1 | impl (anytime after 1) |
| Close | Mobile browser suite on final main, delete `.sprint/`, morning report | all | runner + PM |

WS3, WS4 and WS7 can run concurrently after WS2. WS5 can start alongside WS4 at the data layer, but mounts its UI after WS4 merges. Each WS doc is `ws-NN-*.md` in this folder.
