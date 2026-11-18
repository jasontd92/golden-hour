import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

export function openDb(url: string, authToken?: string) {
	return drizzle(createClient({ url, authToken }));
}

export type Db = ReturnType<typeof openDb>;
