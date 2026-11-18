import type { Db } from './client.ts';
import { failureReason } from '../failure.ts';
import { migrateDb } from './migrate.ts';

export type Database =
	| { status: 'ready'; db: Db }
	| { status: 'unconfigured' }
	| { status: 'unmigrated'; reason: string };

export function migratedOnFirstUse(
	open: () => Promise<Db | undefined>,
	migrate: (db: Db) => Promise<unknown> = migrateDb
): () => Promise<Database> {
	let ready: Promise<Db | undefined> | undefined;
	return async () => {
		ready ??= open().then(async (db) => {
			if (db) await migrate(db);
			return db;
		});
		try {
			const db = await ready;
			return db ? { status: 'ready', db } : { status: 'unconfigured' };
		} catch (error) {
			ready = undefined;
			const reason = failureReason(error);
			console.error(`sync: database not ready (${reason})`);
			return { status: 'unmigrated', reason };
		}
	};
}
