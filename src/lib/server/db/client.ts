import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

export const migrationsFolder = 'drizzle';

export function openDb(url: string, authToken?: string) {
	return drizzle(createClient({ url, authToken }));
}

export type Db = ReturnType<typeof openDb>;

export async function migrateDb(db: Db): Promise<void> {
	await migrate(db, { migrationsFolder });
}
