# WS3 — Data build port (Python → TypeScript)

## Scope
Port `data/build.py` to `scripts/data-build.ts` (`pnpm data:build`). It produces byte-identical `data/normalized/*` and validates the output against WS2 schemas. Then delete `build.py`.

- Keep the same behaviors (read build.py, don't trust this list):
  - the Sheets "53:13:00" time misread
  - rounds+reps canonicalization
  - span-consuming movement tagger, in `movements.json` order
  - alias resolution
  - guess_kind heuristics
  - the REPORT.md sections
- Shared logic (score parsing, tagging) lives in `src/lib/domain` so the app uses the same code.
- CI: a job runs `pnpm data:build` and fails if `git diff --exit-code data/normalized` is non-empty. Normalized output is always committed and current.

## Acceptance criteria
- [ ] Parity: before deleting build.py, run both builds and diff all four outputs. Zero diff (mechanical; attach the command and output to the PR). Allowed exception: JSON key order or whitespace, only if normalized by a stated formatter and both outputs pass through it.
- [ ] `build.py` deleted in the same PR, after parity (mechanical).
- [ ] The CI drift job fails when a curated file changes without a rebuild (mechanical: the verifier edits `curated/results.json` in its worktree and runs the job's command).
- [ ] Output validates against the WS2 schemas (mechanical).

## Risks
- Regex semantics differ between Python and JS: lookbehind, `\b` with Unicode, and `re.sub` vs `String.replace` with a global flag. Test each movement regex against the strings it matches today.
- Python's `json.dump(indent=1)` formatting differs from `JSON.stringify`. Write a formatter that reproduces it, or normalize both sides once.
