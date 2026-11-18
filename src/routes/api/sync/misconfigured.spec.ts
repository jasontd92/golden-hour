import { describe, expect, it, vi } from 'vitest';
import { openDb } from '#lib/server/db/client.ts';
import { migrateDb } from '#lib/server/db/migrate.ts';
import { syncHealth } from '#lib/server/sync.ts';
import { GET } from './+server.ts';

vi.mock('$app/env/private', () => ({
	SYNC_TOKEN: 't',
	TURSO_DATABASE_URL: ' "postgres://user:pass@secret-host.turso.io/db" ',
	TURSO_AUTH_TOKEN: 'secret-token'
}));

type Event = Parameters<typeof GET>[0];

describe('/api/sync GET with an unusable TURSO_DATABASE_URL', () => {
	it('names the scheme it saw and nothing else', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await GET({} as Event);
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body).toEqual({ token: true, database: 'unmigrated', reason: 'LibsqlError URL_SCHEME_NOT_SUPPORTED', urlScheme: 'postgres' });
		expect(JSON.stringify(body)).not.toMatch(/secret|pass/);
	});
});

describe('syncHealth when ready', () => {
	it('stays exactly {token, database} and omits the scheme', async () => {
		const db = await openDb(':memory:');
		await migrateDb(db);
		const response = await syncHealth({ token: 't', database: async () => ({ status: 'ready', db }), urlScheme: 'libsql' });
		expect([response.status, await response.json()]).toEqual([200, { token: true, database: 'ready' }]);
	});
});
