import { describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from './client.ts';
import { migratedOnFirstUse } from './ready.ts';

describe('migratedOnFirstUse', () => {
	it('is unconfigured without a database and never migrates', async () => {
		const migrate = vi.fn();
		expect(await migratedOnFirstUse(() => undefined, migrate)()).toEqual({ status: 'unconfigured' });
		expect(migrate).not.toHaveBeenCalled();
	});

	it('migrates once, and retries on the next request after a failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const db = openDb(':memory:');
		const migrate = vi.fn<(db: Db) => Promise<void>>().mockRejectedValueOnce(Object.assign(new Error('libsql://secret'), { code: 'SERVER_ERROR' })).mockResolvedValue();
		const database = migratedOnFirstUse(() => db, migrate);
		expect(await database()).toEqual({ status: 'unmigrated' });
		expect(console.error).toHaveBeenCalledWith('sync: migrations not applied (Error SERVER_ERROR)');
		expect(await database()).toEqual({ status: 'ready', db });
		expect(await database()).toEqual({ status: 'ready', db });
		expect(migrate).toHaveBeenCalledTimes(2);
	});
});
