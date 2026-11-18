import { createClient, type Row } from '@libsql/client';
import { e2eDbUrl } from './sync-env.ts';

export async function serverRows(table: 'log_entries' | 'session_logs', ids: string[]): Promise<Row[]> {
	const client = createClient({ url: e2eDbUrl });
	try {
		const { rows } = await client.execute({ sql: `SELECT * FROM ${table} WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id`, args: ids });
		return rows;
	} finally {
		client.close();
	}
}
