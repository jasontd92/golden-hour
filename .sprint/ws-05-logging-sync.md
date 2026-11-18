# WS5 — Logging, offline-first, Turso sync

## Scope
- Log flow per README § Design and `.sprint/design/P2Log.dc.html`:
  - steps through the session's sets
  - rep stepper defaulting to the prescribed minimum
  - Done → saved state with estimated 1RM and a rest countdown → Next
  - Undo
  - "Add a note" holds RPE and note
- Local store: IndexedDB (the `idb` package is fine). Every `LogEntry` is written locally first. The UI never waits on the network.
- Outbox sync:
  - pending entries POST in batches to `src/routes/api/sync/+server.ts`
  - the server upserts by `id` into Turso via Drizzle
  - the response returns accepted ids
  - the client marks them synced
  - retry with backoff on `online` events and on app open
  - no Background Sync API (iOS lacks it)
- DB:
  - Drizzle schema for `log_entries`
  - local dev and tests use a libSQL file / `:memory:`
  - production uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel env
  - migrations via drizzle-kit, committed
- Rest timer: wall-clock based (store the end time, not a ticking counter), so it survives the screen locking. Vibration API on finish where supported. iOS web can't run background timers or notify; that's accepted.
- No auth. The sync endpoint takes a shared secret from `SYNC_TOKEN`, entered once on the device and kept in localStorage, so a random visitor can't write.

## Pre-conditions
The CEO creates the Turso database and adds the env vars to Vercel. That's a HALT item if missing at deploy; the code and tests don't need it.

## Acceptance criteria (hold-the-line A: no log entry is ever lost)
- [x] Property test (fast-check): for any sequence of log, undo, go offline, come online, interrupted sync (network failure after the server committed but before the client got the response) and replayed sync, the server ends with exactly the client's set of non-undone entries, with no duplicates and none missing (mechanical). — VERIFIED ws5a-verify on main e0c59b9: 2000 runs pass locally and in CI; gaps: no reload/restart command, no partial-accept server, no-duplicates check is vacuous (PK).
- [x] Mutation proof: remove the upsert-by-id (plain insert) and the property test fails; remove mark-synced-on-ack and it fails. Record both runs in the PR (mechanical; sprint hazard A10/A11). — VERIFIED ws5a-verify: `pnpm proof:sync` 3/3 runs EXIT 0, control passes, 4/4 mutants killed with changed-line counts; recorded on PR #5.
- [ ] WS5b: e2e: log three sets offline, reload, the entries persist locally; go online, the entries reach the API (mechanical; the test server uses `:memory:` libSQL).
- [ ] WS5b: The saved state shows an estimated 1RM equal to `estimatedOneRm` (mechanical).
- [ ] HUMAN (WS5b): CEO logs a real set on the phone in the gym with airplane mode on, then syncs.

## Risks
Undo after sync: model it as a tombstone (`deletedAt`) that syncs, never as a local delete.
