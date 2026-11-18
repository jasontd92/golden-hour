import type { LibSQLDatabase } from 'drizzle-orm/libsql/driver-core';
import { drizzle as remoteDrizzle } from 'drizzle-orm/libsql/web';

export type Db = LibSQLDatabase;

export const isLocalUrl = (url: string) => url === ':memory:' || url.startsWith('file:');

export async function openDb(url: string, authToken?: string): Promise<Db> {
	if (!isLocalUrl(url)) return remoteDrizzle({ connection: { url, authToken } });
	// why: the node driver loads the native libsql binding at import, which Vercel's function bundle lacks; only local URLs need it
	const { drizzle } = await import('drizzle-orm/libsql');
	return drizzle({ connection: { url, authToken } });
}
