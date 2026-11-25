# Agents in this repo

The agent that implements a change does not write, choose or weaken the tests that judge it.

## Roles
- **Implementer.** Writes code. May check its own work as much as it likes, but only in `*.local.spec.ts` files, which git ignores. Its own checks are never committed and never the final word.
- **Oracle.** A separate session: `pnpm oracle "<brief>"`, which runs `.claude/agents/oracle.md` with `ROLE=oracle`. Gets the intent, not a tour of the code. Writes the committed tests, named for the claim each proves, in commits with the trailer `Verified-by: oracle`.
- **Verifier / reviewer.** Fresh, after the implementation. Runs the tests and judges the gaps. Never the implementer.

## Enforced
- The `.claude/settings.json` hook refuses a commit that stages tests (`*.spec.ts`, `*.e2e.ts`) outside the oracle session. It also refuses `gh pr merge` unless every check is green.
- CI's "tests come from the oracle" step fails a PR whose non-merge commits change tests without the oracle trailer.

## What needs an oracle (for briefs and PR review)
- **Behaviour change:** yes, even a short pass. "Existing test X already covers this" is a valid prescription, but the oracle makes it.
- **Tests or verification tooling:** yes, and the PR is held with `ceo-review`.
- **Docs, data, dependency bumps, or a refactor that leaves every test unchanged:** no. The unchanged suite is the proof.

A reviewer flags a behaviour change that skipped the oracle, and tests that would pass on a plausible wrong implementation.

## Every check must earn its cost
`pnpm ledger` reports, per check, what it caught, what it cost and what got past it. A check that keeps catching nothing real, at real cost, is a candidate for removal, including the oracle and the reviewers.
- **CI checks** need nothing stored: the report reads their history from GitHub and counts one catch per run of failing commits ended by a passing one.
- **Local and agent checks** leave nothing behind unless they record a run in `verification/runs/`. `pnpm mutate`, `pnpm proof:sync`, `pnpm e2e:local` and `pnpm oracle` do it automatically, and the guard hook records each block. After any other agent verification (`/code-review`, Codex, a verifier), record it: `pnpm ledger agent <name> --tokens N [--caught N] [--usd X] [--minutes M] [--pr N] [--detail "..."]`, where `--caught` counts only findings that led to a fix commit, so the evidence is the fix, not the agent's own grading.
- **Escapes:** every mistake found after merge (on main, by the canary, or by you) gets `pnpm ledger escape "<what>" --found-by <who> --should-have-caught <check> [--introduced-in <pr>]`. Escapes are the outcome that matters.
- Commit the new files under `verification/` with the PR they belong to.
