import { SYNC_TOKEN, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from '$app/env/private';
import { openDb, type Db } from './db/client.ts';
import type { SyncDeps } from './sync.ts';

let db: Db | undefined;

export function syncDb(): Db | undefined {
	if (!TURSO_DATABASE_URL) return undefined;
	db ??= openDb(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN);
	return db;
}

export function syncDeps(): SyncDeps {
	return { token: SYNC_TOKEN, db: syncDb };
}
