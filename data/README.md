# Golden Hour training data

The historical record behind Evolution 5 and the app. Plain files. There's no database yet, but it's shaped so it can be loaded into one later.

```
raw/          immutable source captures; never edited
  sugarwod/          workouts.csv export (Mar 2021 – Nov 2024, 289 rows)
  sugarwod-screens/  profile screenshots 2026-11-17 (barbell maxes, benchmark bests)
  apple-notes/       personal benchmark notes (Turkey Trot Triple, Cunningham, …)
  google-sheet/      Tests, Evo 1–4 and General Principles tabs (API JSON)
curated/      hand-entered or hand-checked facts; editing these is where judgment goes
  workouts.json      definitions SugarWOD lacks (personal WODs, tests, aliases)
  results.json       results transcribed from Notes / Tests / Evo tabs, with provenance
  movements.json     movement vocabulary: pattern, M/G/W modality, home availability
  sugarwod_snapshot_2026-11-17.json   transcribed screenshots
build.py      raw + curated → normalized (rerun any time; deterministic)
normalized/   generated; what the app and coach agents read
  workouts.json   catalog
  results.jsonl   every performance
  lifts.json      rep-max evidence by lift
  REPORT.md       gaps, conflicts, recurring anchors
```

## Data model

**Workout** (definition, one per distinct workout)
- `id` (slug), `name`, `aliases`
- `kind`: girl | hero | notable | competition | test | personal | class_wod | strength
- `description`; for SugarWOD workouts, every distinct description seen (`descriptions`)
- `format`: for_time | amrap | emom | intervals | max_load | max_reps | composite
- `score.type` + `score.better` (lower/higher). This decides how results sort and what counts as a PR.
- `tags`: movements, patterns, modality (M/G/W), home_ok. Each has a `tag_source` of auto or hand.
- `favorite`, `recurrence` (e.g. annual at Thanksgiving), `definition_status`, `sources`

**Result** (one performance)
- `workout`, `date` + `date_precision` (day | month | unknown), `date_text` when the year is unknown
- `score_display` (as logged) + canonical `value`/`unit`. Time is stored in seconds. Rounds+reps is stored as rounds + reps/1000 so it sorts correctly.
- `rx` (rx | scaled | scaled_up), `splits`, `sets`, `detail` (e.g. CFT 255/160/335), `location`, `notes`
- `test_round` when it belongs to a test battery (2023-04, 2023-08, 2023-10, 2024-02, 2025-08, 2026-11)
- `source` (file + row), `duplicate_of`, `conflict`

**Lift evidence**: `lift`, `load`, `reps` (1/2/3/5RM or null), `date`, `source`.

### Rules
1. **Provenance on every fact.** The same test often appears in 2–4 places: SugarWOD, Tests tab, an Evo tab, a Note. They don't always agree. Keep every observation with its source and flag conflicts; never silently pick one. The app picks the best value at read time.
2. **Never invent precision.** Use a month-precision date when the Sheet gives only the test round, and `unknown` for "11/9" entries with no year.
3. **Raw is read-only.** Fixes go in `curated/`; `normalized/` is always regenerated.

## Where labeling effort goes (in priority order)
1. **Test battery and recurring benchmarks** (CFT, pull-ups, 10k, 400m, L-sit, Grace/Fran/Diane/Amanda, bike, Kong is King, Launchpad, the annual favorites). These set every load and pace and every checkpoint target, so they get hand-checked, with exact identity, dates and conflicts resolved with the athlete. *Done for everything found. Kong is King is lost; Launchpad is reconstructed.*
2. **Lift rep-maxes.** These are used to prescribe loads for lifts that aren't in 5/3/1 (cleans, thrusters, front squat). *Transcribed; duplicate SugarWOD rows still need explaining.*
3. **Movement tags on the WOD catalog.** This is the idea bank used to compose WODs: filter by pattern, modality, time domain and home equipment. *Auto-tagged by regex. Spot-check only the workouts used as templates; don't hand-label all 259.*
4. **Long tail** (one-off class WODs, Evo 1–4 session logs). Stored raw and kept searchable; parsed only when needed.

## Known gaps
- Kong is King is lost: nobody remembers it and no source has it.
- Launchpad is reconstructed from memory (Annie with half-rep burpees for double-unders). Confidence is low and past times aren't comparable.
- Other SugarWOD benchmark categories (Heroes, Open) and the Personal Records tab weren't captured. The barbell table is complete.
- No session-level data after Nov 2024 (home-gym era) except the Sheet.
- The Evo 1–4 session logs aren't parsed into results yet; only their test days are.
