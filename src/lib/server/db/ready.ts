import type { Db } from './client.ts';
import { migrateDb } from './migrate.ts';

export type Database = { status: 'ready'; db: Db } | { status: 'unconfigured' | 'unmigrated' };

export function migratedOnFirstUse(open: () => Db | undefined, migrate: (db: Db) => Promise<unknown> = migrateDb): () => Promise<Database> {
	let db: Db | undefined;
	let migrated: Promise<void> | undefined;
	return async () => {
		db ??= open();
		if (!db) return { status: 'unconfigured' };
		const target = db;
		migrated ??= migrate(target).then(
			() => undefined,
			(error: unknown) => {
				migrated = undefined;
				const code = (error as { code?: unknown } | null)?.code;
				console.error(`sync: migrations not applied (${error instanceof Error ? error.name : 'error'}${code ? ` ${String(code)}` : ''})`);
				throw error;
			}
		);
		return migrated.then(
			(): Database => ({ status: 'ready', db: target }),
			(): Database => ({ status: 'unmigrated' })
		);
	};
}
