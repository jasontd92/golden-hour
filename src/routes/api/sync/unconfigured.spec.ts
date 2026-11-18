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

describe('/api/sync when the server module throws', () => {
	it('answers 503 with a status, never 500', async () => {
		vi.resetModules();
		vi.doMock('#lib/server/sync-env.ts', () => {
			throw Object.assign(new Error('native binding missing at libsql://secret'), { code: 'ERR_DLOPEN_FAILED' });
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const route = await import('./+server.ts');
		const get = await route.GET({} as Event);
		expect(get.status).toBe(503);
		const body = await get.json();
		expect(body).toMatchObject({ token: false, database: 'error' });
		expect(JSON.stringify(body)).not.toContain('secret');
		const post = await route.POST({ request: new Request('http://app.test', { method: 'POST', body: '{}' }) } as Event);
		expect(post.status).toBe(503);
		expect(await post.json()).not.toHaveProperty('accepted');
		vi.doUnmock('#lib/server/sync-env.ts');
	});
});
