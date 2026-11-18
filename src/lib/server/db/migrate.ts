import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Db } from './client.ts';

export interface Migration {
	tag: string;
	when: number;
	sql: string;
}

interface Journal {
	entries: { tag: string; when: number }[];
}

const files = import.meta.glob<string>('/drizzle/*.sql', { query: '?raw', import: 'default', eager: true });
const [journal] = Object.values(import.meta.glob<Journal>('/drizzle/meta/_journal.json', { import: 'default', eager: true }));

export const bundledMigrations: Migration[] = (journal?.entries ?? []).map(({ tag, when }) => {
	const text = files[`/drizzle/${tag}.sql`];
	if (text === undefined) throw new Error(`drizzle/${tag}.sql is in the journal but not bundled.`);
	return { tag, when, sql: text };
});

export async function migrateDb(db: Db, migrations: Migration[] = bundledMigrations): Promise<number> {
	await db.run(sql`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`);
	const [last] = await db.all<{ created_at: number }>(
		sql`SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`
	);
	const pending = migrations.filter((migration) => !last || Number(last.created_at) < migration.when);
	const statements = pending.flatMap((migration) => [
		...migration.sql.split('--> statement-breakpoint').map((statement) => db.run(sql.raw(statement))),
		db.run(
			sql`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (${createHash('sha256').update(migration.sql).digest('hex')}, ${migration.when})`
		)
	]);
	const [first, ...rest] = statements;
	if (first) await db.batch([first, ...rest]);
	return pending.length;
}
