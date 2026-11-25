# Golden Hour

A phone-first, installable training app for one athlete. The methodology behind it lives in `team/`, `profiles/` and `prompts/`; the training history lives in `data/`.

```sh
pnpm install
pnpm dev        # local app
pnpm check      # the full gate: types, lint, policy, unit tests
pnpm test:e2e   # mobile WebKit and Chromium
pnpm ledger     # per check: what it caught, what it cost, what got past it
```

**Verification ledger.** Every check here has to earn its cost. `pnpm ledger` combines CI history from GitHub with `verification/runs/` (local and agent checks: mutation testing, sync proof, local e2e, oracle sessions, reviews, guard-hook blocks) and `verification/escapes/` (mistakes found after merge, charged to the check that should have caught them). The rules for who writes tests and how runs and escapes are recorded are in `AGENTS.md`.
