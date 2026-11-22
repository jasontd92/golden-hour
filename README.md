# Golden Hour

A phone-first, installable training app for one athlete. The methodology behind it lives in `team/`, `profiles/` and `prompts/`; the training history lives in `data/`.

```sh
pnpm install
pnpm dev        # local app
pnpm check      # the full gate: types, lint, policy, unit tests
pnpm test:e2e   # mobile WebKit and Chromium
pnpm ledger     # what each kind of verification has caught, and what it cost
```

**Verification ledger.** `verification/ledger/` has one file per PR recording which check caught each mistake (CI, mutation, e2e, oracle tests, review, or a human), whether it was real or a flake, and what verification cost. It is how this repo decides which checks earn their keep. The rules for who writes tests and how catches are recorded are in `AGENTS.md`.
