import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

export const e2eSyncToken = 'e2e-sync-token';

// why: test workers read this file while the preview server writes it; in the default rollback journal a read during a write fails at once with SQLITE_BUSY, and WAL (persisted in the file) lets readers and the one writer run together
export function createE2eDatabase(dir: string): string {
	const file = path.join(dir, 'log.db');
	const db = new DatabaseSync(file);
	db.exec('PRAGMA journal_mode = WAL');
	db.close();
	return pathToFileURL(file).href;
}

// why: the runner sets this before forking workers, so the preview server and every test read the same database file
process.env.GOLDEN_HOUR_E2E_DB ??= createE2eDatabase(mkdtempSync(path.join(tmpdir(), 'golden-hour-e2e-')));

export const e2eDbUrl = process.env.GOLDEN_HOUR_E2E_DB;

export const e2eServerEnv = { SYNC_TOKEN: e2eSyncToken, TURSO_DATABASE_URL: e2eDbUrl };
