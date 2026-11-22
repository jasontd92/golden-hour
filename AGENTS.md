# Agents in this repo

The agent that implements a change does not write, choose or weaken the tests that judge it.

## Roles
- **Implementer.** Writes code. May check its own work as much as it likes, but only in `*.local.spec.ts` files, which git ignores. Its own checks are never committed and never the final word.
- **Oracle.** A separate session: `pnpm oracle "<brief>"`, which runs `.claude/agents/oracle.md` with `ROLE=oracle`. Gets the intent, not a tour of the code. Writes `verification.yaml` and the committed tests, in commits with the trailer `Verified-by: oracle`.
- **Verifier / reviewer.** Fresh, after the implementation. Runs the manifest and judges the gaps. Never the implementer.

## Enforced
- The `.claude/settings.json` hook refuses a commit that stages tests (`*.spec.ts`, `*.e2e.ts`, `verification.yaml`) outside the oracle session. It also refuses `gh pr merge` unless every check is green.
- CI's "tests come from the oracle" step fails a PR whose non-merge commits change tests without the oracle trailer.

## What needs an oracle (for briefs and PR review)
- **Behaviour change:** yes, even a short pass. "Existing test X already covers this" is a valid prescription, but the oracle makes it.
- **Tests or verification tooling:** yes, and the PR is held with `ceo-review`.
- **Docs, data, dependency bumps, or a refactor that leaves every test unchanged:** no. The unchanged suite is the proof.

A reviewer flags a behaviour change that skipped the oracle, and tests that would pass on a plausible wrong implementation.

## Record what each check catches
Every PR gets `verification/ledger/<pr>.json`: what caught each mistake, whether it was real, and what verification cost. `pnpm ledger` summarizes it.
- **Programmatic** (CI, budgets, mutation, e2e): `pnpm ledger draft <pr>` adds every check that failed on one commit and passed on a later one.
- **Agent and human** (oracle tests, verifier, reviewer, Codex, you): whoever catches it adds `{"by", "kind", "what", "real"}`.
- Mark each catch `"real": true` (a real mistake) or `false` (a flake or a false alarm).
- Costs are per check: the draft adds CI minutes per check run; each agent role adds `{"by": "oracle", "runs", "tokens"}` from its session's output.
- Every kind of verification must prove its value against its cost. One that keeps showing no real catches is a candidate for removal, and that includes the oracle and the reviewers.
- A mistake caught after merge (e2e on main, the canary) goes in the ledger of the PR that fixes it, naming the PR that caused it.
The verifier, or whoever merges, completes the entry before merging.
