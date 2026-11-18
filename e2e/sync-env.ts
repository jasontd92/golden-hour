import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const e2eSyncToken = 'e2e-sync-token';

// why: the runner sets this before forking workers, so the preview server and every test read the same database file
process.env.GOLDEN_HOUR_E2E_DB ??= pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'golden-hour-e2e-')), 'log.db')).href;

export const e2eDbUrl = process.env.GOLDEN_HOUR_E2E_DB;

export const e2eServerEnv = { SYNC_TOKEN: e2eSyncToken, TURSO_DATABASE_URL: e2eDbUrl };
