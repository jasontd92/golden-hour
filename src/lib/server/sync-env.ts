import { SYNC_TOKEN, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from '$app/env/private';
import { openDb } from './db/client.ts';
import { normalizeDbUrl, urlScheme } from './db/url.ts';
import { migratedOnFirstUse } from './db/ready.ts';
import { handleSync, syncHealth, type SyncDeps } from './sync.ts';

export const syncDatabase = migratedOnFirstUse(async () => {
	const url = normalizeDbUrl(TURSO_DATABASE_URL);
	return url ? openDb(url, normalizeDbUrl(TURSO_AUTH_TOKEN)) : undefined;
});

export function syncDeps(): SyncDeps {
	return { token: SYNC_TOKEN, database: syncDatabase, urlScheme: urlScheme(TURSO_DATABASE_URL) };
}

export const sync = (request: Request) => handleSync(request, syncDeps());

export const health = () => syncHealth(syncDeps());
