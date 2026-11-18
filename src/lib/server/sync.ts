import { createHash, timingSafeEqual } from 'node:crypto';
import { SyncRequest, type SyncResponse } from '#lib/domain/log.ts';
import type { Db } from './db/client.ts';
import { logEntriesReadable, upsertLogRecords } from './db/log-entries.ts';

export interface SyncDeps {
	token: string | undefined;
	db: () => Db | undefined;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

export function bearerMatches(header: string | null, token: string): boolean {
	const presented = header?.match(/^Bearer (.+)$/)?.[1];
	return presented !== undefined && timingSafeEqual(digest(presented), digest(token));
}

const failure = (status: number, error: string) => Response.json({ error }, { status });

export async function handleSync(request: Request, deps: SyncDeps): Promise<Response> {
	if (!deps.token) return failure(503, 'SYNC_TOKEN is not set on this deployment.');
	const db = deps.db();
	if (!db) return failure(503, 'TURSO_DATABASE_URL is not set on this deployment.');
	if (!bearerMatches(request.headers.get('authorization'), deps.token)) {
		return failure(401, 'Wrong or missing sync token.');
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return failure(400, 'Body must be JSON.');
	}
	const parsed = SyncRequest.safeParse(body);
	if (!parsed.success) return failure(400, parsed.error.message);
	await upsertLogRecords(db, parsed.data.records, new Date().toISOString());
	const response: SyncResponse = { accepted: parsed.data.records.map((record) => record.id) };
	return Response.json(response);
}

export async function syncHealth(deps: SyncDeps): Promise<Response> {
	const db = deps.db();
	const database = !db ? 'unconfigured' : (await logEntriesReadable(db)) ? 'ready' : 'unmigrated';
	const token = Boolean(deps.token);
	return Response.json({ token, database }, { status: token && database === 'ready' ? 200 : 503 });
}
