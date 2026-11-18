import { syncBatchLimit, SyncResponse, type SyncRequest } from '#lib/domain/log.ts';
import type { LogStore } from './store.ts';

export type Transport = (request: SyncRequest) => Promise<Response>;

export type SyncOutcome =
	| { kind: 'synced'; count: number }
	| { kind: 'offline' }
	| { kind: 'unauthorized' }
	| { kind: 'failed'; status: number };

export function httpTransport(token: string, fetcher: typeof fetch = fetch, url = '/api/sync'): Transport {
	return (request) =>
		fetcher(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify(request)
		});
}

export async function syncOutbox(store: LogStore, send: Transport, batchSize = syncBatchLimit): Promise<SyncOutcome> {
	let count = 0;
	for (;;) {
		const records = await store.pending(batchSize);
		if (records.length === 0) return { kind: 'synced', count };
		let response: Response;
		try {
			response = await send({ records });
		} catch {
			return { kind: 'offline' };
		}
		if (response.status === 401) return { kind: 'unauthorized' };
		const body = response.ok ? SyncResponse.safeParse(await response.json().catch(() => undefined)) : undefined;
		if (!body?.success) return { kind: 'failed', status: response.status };
		const marked = await store.acknowledge(records, body.data.accepted);
		if (marked === 0 && (await store.stillPending(records)) > 0) return { kind: 'failed', status: response.status };
		count += marked;
	}
}
