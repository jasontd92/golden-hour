import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateAndVerify, migrationTarget } from './db-migrate.ts';

describe('migrationTarget', () => {
	it('migrates production builds and explicit local runs only', () => {
		const url = 'libsql://example.turso.io';
		expect(migrationTarget({ VERCEL_ENV: 'production', TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: 't' })).toEqual({ url, authToken: 't' });
		expect(migrationTarget({ VERCEL_ENV: 'preview', TURSO_DATABASE_URL: url })).toBe('skip');
		expect(migrationTarget({})).toBe('skip');
		expect(migrationTarget({ TURSO_DATABASE_URL: url })).toEqual({ url, authToken: undefined });
		expect(() => migrationTarget({ VERCEL_ENV: 'production' })).toThrow(/TURSO_DATABASE_URL/);
	});
});

describe('migrateAndVerify', () => {
	it('is idempotent on an existing database', async () => {
		const url = `file:${path.join(mkdtempSync(path.join(tmpdir(), 'db-migrate-')), 'log.db')}`;
		expect(await migrateAndVerify(url)).toBe(0);
		expect(await migrateAndVerify(url)).toBe(0);
	});
});
