# WS2 — Domain contract

## Scope
zod schemas and inferred types in `src/lib/domain/`. This is the single contract for the build script, the app and the coaches debate output. Mirror the current JSON shapes in `data/normalized/` (read `data/README.md` § Data model and the files themselves; don't trust this doc's field lists).

- `Workout`, `Result`, `LiftEvidence`: match `normalized/workouts.json`, `results.jsonl` and `lifts.json` exactly.
- `PlanSession`: one programmed day.
  - `date`, `week` (1–16), `title`, `why` (one or two sentences), `location` (home | rec), `minutes`
  - `blocks[]`, each with:
    - `name`, `kind` (warmup | strength | metcon | conditioning | skill | cooldown), `minutes`, `hard`
    - `prescription`: a discriminated union:
      - `percentSets` (lift, trainingMaxRef, sets of {pct, reps, amrap})
      - `fixedSets` (movement, sets, reps, load)
      - `amrap` / `forTime` / `emom` / `intervals` (movements[] of {movement id from `data/curated/movements.json`, reps|distance|calories|seconds, load})
      - `freeText` (escape hatch; lint-free but flagged in a report)
    - `notes`: an optional short string
- `LogEntry`:
  - `id` (uuid v7, client-generated), `sessionDate`, `blockIndex`, `setIndex`
  - `movement`, `load`, `reps`, `rpe?`, `note?`
  - `loggedAt`, `deviceId`
  - Idempotent by `id`.
- Calculators (pure, unit-tested):
  - `trainingMax(oneRm, pct = 0.9)`
  - `wendlerSet(tm, pct)`, rounded to 5 lb
  - `estimatedOneRm(load, reps)` = load × reps × 0.0333 + load
  - `parseScore` / `formatScore` matching build.py's canonical rules (time → seconds; rounds + reps/1000)
- `fixtures/plan/week-01.json`: the placeholder week from the mockups, validated by the schema. Mon 2026-12-07:
  - Back squat 5/3/1 week 1 with TM 265: 170×5, 200×5, 225×5+. Then 5×5 @170 with strict pull-ups 5×6.
  - AMRAP 12 (hard): 8 DB snatches 45 lb, 10 box jumps 24", 200 m run.
  - Warm-up 8 min, cool-down 6 min.

  The other days are as in `.sprint/design/P2Week.dc.html`, with plausible detail. This is a PLACEHOLDER, replaced by the debate output.

## Acceptance criteria
- [ ] Every line of `data/normalized/results.jsonl` and every entry in `workouts.json` and `lifts.json` parses (mechanical: a vitest test over the real files).
- [ ] `week-01.json` parses (mechanical).
- [ ] Calculator tests: `estimatedOneRm(225, 7)` → 277 (rounded), `wendlerSet(265, 0.85)` → 225, `trainingMax(295)` → 265 (rounded to 5) (mechanical).
- [ ] `domain` has zero imports from outside `domain` and zod (mechanical: lint boundary).
- [ ] A JSON Schema export (`pnpm schema:emit` → `schemas/*.json`) so the debate tooling can validate without TS (mechanical: the files exist and validate the fixture).

## Risks
Over-modeling the prescription union. Add a variant only when a real session needs it, and use `freeText` otherwise.
