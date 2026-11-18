import { createHash, timingSafeEqual } from 'node:crypto';
import { SyncRequest, type SyncResponse } from '#lib/domain/log.ts';
import type { Database } from './db/ready.ts';
import type { UrlScheme } from './db/url.ts';
import { logEntriesReadable, upsertLogRecords } from './db/log-entries.ts';

export interface SyncDeps {
	token: string | undefined;
	database: () => Promise<Database>;
	urlScheme?: UrlScheme;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

export function bearerMatches(header: string | null, token: string): boolean {
	const presented = header?.match(/^Bearer (.+)$/)?.[1];
	return presented !== undefined && timingSafeEqual(digest(presented), digest(token));
}

const failure = (status: number, error: string) => Response.json({ error }, { status });

const notReady = {
	unconfigured: 'TURSO_DATABASE_URL is not set on this deployment.',
	unmigrated: 'The log database could not be migrated; nothing was stored.'
};

export async function handleSync(request: Request, deps: SyncDeps): Promise<Response> {
	if (!deps.token) return failure(503, 'SYNC_TOKEN is not set on this deployment.');
	if (!bearerMatches(request.headers.get('authorization'), deps.token)) {
		return failure(401, 'Wrong or missing sync token.');
	}
	const database = await deps.database();
	if (database.status !== 'ready') return failure(503, notReady[database.status]);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return failure(400, 'Body must be JSON.');
	}
	const parsed = SyncRequest.safeParse(body);
	if (!parsed.success) return failure(400, parsed.error.message);
	await upsertLogRecords(database.db, parsed.data.records, new Date().toISOString());
	const response: SyncResponse = { accepted: parsed.data.records.map((record) => record.id) };
	return Response.json(response);
}

export async function syncHealth(deps: SyncDeps): Promise<Response> {
	const database = await deps.database();
	const readable = database.status !== 'ready' || (await logEntriesReadable(database.db));
	const status = readable ? database.status : 'unmigrated';
	const token = Boolean(deps.token);
	const reason = database.status === 'unmigrated' ? { reason: database.reason } : {};
	const scheme = status === 'unmigrated' && deps.urlScheme ? { urlScheme: deps.urlScheme } : {};
	return Response.json({ token, database: status, ...reason, ...scheme }, { status: token && status === 'ready' ? 200 : 503 });
}
