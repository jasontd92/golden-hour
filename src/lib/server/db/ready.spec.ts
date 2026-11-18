import { describe, expect, it, vi } from 'vitest';
import { isLocalUrl, openDb, type Db } from './client.ts';
import { failureReason } from '../failure.ts';
import { migratedOnFirstUse } from './ready.ts';

describe('openDb', () => {
	it('uses the native client only for local URLs', () => {
		expect([':memory:', 'file:/tmp/x.db', 'libsql://db.turso.io', 'https://db.turso.io'].map(isLocalUrl)).toEqual([true, true, false, false]);
	});
});

describe('failureReason', () => {
	it('keeps only the error name and a code-shaped code', () => {
		expect(failureReason(Object.assign(new Error('libsql://db with token'), { code: 'SERVER_ERROR' }))).toBe('Error SERVER_ERROR');
		expect(failureReason(Object.assign(new TypeError('x'), { code: 'libsql://db.turso.io' }))).toBe('TypeError');
		expect(failureReason('boom')).toBe('string');
	});
});

describe('migratedOnFirstUse', () => {
	it('is unconfigured without a database and never migrates', async () => {
		const migrate = vi.fn();
		expect(await migratedOnFirstUse(async () => undefined, migrate)()).toEqual({ status: 'unconfigured' });
		expect(migrate).not.toHaveBeenCalled();
	});

	it('reports an open failure as unmigrated with a redacted reason', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const database = migratedOnFirstUse(async () => {
			throw new TypeError('cannot load libsql://secret');
		});
		expect(await database()).toEqual({ status: 'unmigrated', reason: 'TypeError' });
	});

	it('migrates once, and retries on the next request after a failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const db = await openDb(':memory:');
		const migrate = vi.fn<(db: Db) => Promise<void>>().mockRejectedValueOnce(Object.assign(new Error('libsql://secret'), { code: 'SERVER_ERROR' })).mockResolvedValue();
		const database = migratedOnFirstUse(async () => db, migrate);
		expect(await database()).toEqual({ status: 'unmigrated', reason: 'Error SERVER_ERROR' });
		expect(console.error).toHaveBeenCalledWith('sync: database not ready (Error SERVER_ERROR)');
		expect(await database()).toEqual({ status: 'ready', db });
		expect(await database()).toEqual({ status: 'ready', db });
		expect(migrate).toHaveBeenCalledTimes(2);
	});
});
