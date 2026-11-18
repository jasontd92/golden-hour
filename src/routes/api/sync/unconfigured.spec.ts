import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server.ts';

vi.mock('$app/env/private', () => ({ SYNC_TOKEN: undefined, TURSO_DATABASE_URL: undefined, TURSO_AUTH_TOKEN: undefined }));

type Event = Parameters<typeof POST>[0];

describe('/api/sync without SYNC_TOKEN', () => {
	it('fails closed with 503 and never reads the body', async () => {
		const request = new Request('http://app.test/api/sync', { method: 'POST', body: '{"records":[]}' });
		const response = await POST({ request } as Event);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'SYNC_TOKEN is not set on this deployment.' });
		expect(request.bodyUsed).toBe(false);
	});

	it('reports what is missing on GET', async () => {
		const response = await GET({} as Event);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ token: false, database: 'unconfigured' });
	});
});
