import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

export function migrationTarget(env: NodeJS.ProcessEnv): { url: string; authToken?: string } | 'skip' {
	const production = env.VERCEL_ENV === 'production';
	if (env.VERCEL_ENV && !production) return 'skip';
	if (!env.TURSO_DATABASE_URL) {
		if (production) throw new Error('db-migrate: TURSO_DATABASE_URL is not set for the production build.');
		return 'skip';
	}
	return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
}

export async function migrateAndVerify(url: string, authToken?: string): Promise<number> {
	const client = createClient({ url, authToken });
	try {
		const db = drizzle(client);
		await migrate(db, { migrationsFolder: 'drizzle' });
		const [row] = await db.all<{ count: number }>(sql`select count(*) as count from log_entries`);
		return Number(row?.count);
	} finally {
		client.close();
	}
}

if (import.meta.main) {
	const target = migrationTarget(process.env);
	if (target === 'skip') {
		console.log('db-migrate: skipped (not a production build with TURSO_DATABASE_URL)');
	} else {
		const count = await migrateAndVerify(target.url, target.authToken);
		console.log(`db-migrate: migrations applied; log_entries readable (${count} rows)`);
	}
}
