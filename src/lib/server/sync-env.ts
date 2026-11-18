import { SYNC_TOKEN, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from '$app/env/private';
import { openDb } from './db/client.ts';
import { migratedOnFirstUse } from './db/ready.ts';
import { handleSync, syncHealth, type SyncDeps } from './sync.ts';

export const syncDatabase = migratedOnFirstUse(async () =>
	TURSO_DATABASE_URL ? openDb(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN) : undefined
);

export function syncDeps(): SyncDeps {
	return { token: SYNC_TOKEN, database: syncDatabase };
}

export const sync = (request: Request) => handleSync(request, syncDeps());

export const health = () => syncHealth(syncDeps());
