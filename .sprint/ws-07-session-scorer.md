# WS7 — Agent-session scorer

## Scope
`scripts/score-sessions.ts` (`pnpm sessions:score`) reads Claude Code transcripts for this repo from `~/.claude/projects/` (directories whose sessions ran with cwd under golden-hour, including worktrees) and prints a compact table per session plus totals. It reads only, and never uploads anything.

Per session:
- duration, tool calls by tool, tokens (input, output, cache)
- **time and tool calls to first relevant file**: the first Read or Edit of a file that the session's eventual commit touched
- dead ends: Reads of files never used, failed tool calls, repeated identical searches
- commands that failed and were retried
- for sprint EMs: CI runs per PR until green, review findings per PR (via `gh` when available), and reverts on main touching that PR's files

Output: stdout table plus `--json`. No persistent report files (docs policy). The PM reads the output at program close and turns each repeated inefficiency into a lint rule, a directory or naming fix, or a policy-check change.

## Acceptance criteria
- [x] Runs over at least one real transcript of this repo and prints all columns (mechanical). Verified: 11 real sessions, 16 columns plus totals; `--json` has every field.
- [x] Unit tests over a small synthetic transcript fixture (committed and sanitized: no personal content) give known values for each metric (mechanical). Verified: 15 tests, 68 total; the fixture is synthetic.
- [x] Never reads transcripts outside golden-hour sessions (mechanical: a fixture with a foreign cwd is skipped). Verified: all kept cwds are under golden-hour; 38 foreign files had 1 record parsed; removing any of the 3 guards fails the tests.
- [ ] HUMAN: CEO judges whether the metrics are the useful ones.

## Risks
The transcript JSONL format is undocumented and can change. Parse defensively and skip unknown record types.
