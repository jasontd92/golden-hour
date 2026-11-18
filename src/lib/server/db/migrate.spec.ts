import { readdirSync, readFileSync } from 'node:fs';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { describe, expect, it } from 'vitest';
import { openDb } from './client.ts';
import { logEntriesReadable } from './log-entries.ts';
import { bundledMigrations, migrateDb } from './migrate.ts';

describe('bundledMigrations', () => {
	it('bundles every committed drizzle migration in journal order', () => {
		const onDisk = readdirSync('drizzle').filter((file) => file.endsWith('.sql')).sort();
		expect(bundledMigrations.map((m) => `${m.tag}.sql`)).toEqual(onDisk);
		for (const migration of bundledMigrations) expect(migration.sql).toBe(readFileSync(`drizzle/${migration.tag}.sql`, 'utf8'));
	});
});

describe('migrateDb', () => {
	it('applies once, then is a no-op', async () => {
		const db = openDb(':memory:');
		expect(await migrateDb(db)).toBe(bundledMigrations.length);
		expect(await migrateDb(db)).toBe(0);
		expect(await logEntriesReadable(db)).toBe(true);
	});

	it('agrees with drizzle-kit\'s own migrator in both directions', async () => {
		const byDrizzle = openDb(':memory:');
		await migrate(byDrizzle, { migrationsFolder: 'drizzle' });
		expect(await migrateDb(byDrizzle)).toBe(0);
		const byUs = openDb(':memory:');
		await migrateDb(byUs);
		await expect(migrate(byUs, { migrationsFolder: 'drizzle' })).resolves.toBeUndefined();
		const hashes = (db: typeof byUs) => db.all(`select hash, created_at from __drizzle_migrations`);
		expect(await hashes(byUs)).toEqual(await hashes(byDrizzle));
	});
});
