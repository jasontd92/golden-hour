# WS6 — Progress

## Scope
Per README § Design and `.sprint/design/P2Progress.dc.html`.

- Two lists, Benchmarks and Lifts (1RM), each showing only the best value.
- Benchmarks: the favorites (Turkey Trot Triple, Jason Cunningham), the test battery and recurring benchmarks. Use the "Recurring … comparison anchors" in `data/normalized/REPORT.md` and `kind: test` in workouts. Order is a decision: favorites first, then test battery, then girls.
- Best = the sort by `score.better`. Where results conflict, show the best non-conflicted value and a muted marker; never silently pick (data/README rule 1).
- Lifts: from `lifts.json`, max of 1RM evidence per lift.
- Tapping a row opens a detail list of every result: date (respecting `date_precision`), score and source label.
- Data is bundled at build time from `data/normalized` (read-only). Logged sets from WS5 are merged later and are out of scope here.

## Acceptance criteria
- [ ] Unit tests: the best Fran is 4:43, the best back squat 1RM is 295, and the best CrossFit Total respects the recorded conflict handling (mechanical; verify the expected values against the data files, not this doc).
- [ ] e2e: Progress renders both lists; tapping Fran shows its result history (mechanical, with screenshots).
- [ ] Results with unknown-precision dates render as their `date_text` (mechanical).
- [ ] HUMAN: CEO checks the numbers look right.
