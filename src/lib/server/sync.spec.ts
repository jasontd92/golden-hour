import { describe, expect, it } from 'vitest';
import { openDb } from './db/client.ts';
import type { Database } from './db/ready.ts';
import { bearerMatches, handleSync, syncHealth } from './sync.ts';

const database = (value: Database) => async () => value;
const post = () =>
	new Request('http://app.test/api/sync', { method: 'POST', headers: { authorization: 'Bearer t' }, body: '{"records":[]}' });

describe('bearerMatches', () => {
	it('accepts only the exact bearer token', () => {
		expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
		expect(bearerMatches('Bearer s3cret2', 's3cret')).toBe(false);
		expect(bearerMatches('s3cret', 's3cret')).toBe(false);
		expect(bearerMatches(null, 's3cret')).toBe(false);
	});
});

describe('handleSync', () => {
	it.each(['unconfigured', 'unmigrated'] as const)('fails closed with 503 and accepts nothing when the database is %s', async (status) => {
		const request = post();
		const response = await handleSync(request, { token: 't', database: database({ status }) });
		expect(response.status).toBe(503);
		expect(await response.json()).not.toHaveProperty('accepted');
		expect(request.bodyUsed).toBe(false);
	});
});

describe('syncHealth', () => {
	it('reports each failure as a status, never a value', async () => {
		const health = async (deps: Parameters<typeof syncHealth>[0]) => {
			const response = await syncHealth(deps);
			return [response.status, await response.json()];
		};
		expect(await health({ token: 't', database: database({ status: 'unmigrated' }) })).toEqual([503, { token: true, database: 'unmigrated' }]);
		expect(await health({ token: undefined, database: database({ status: 'unconfigured' }) })).toEqual([503, { token: false, database: 'unconfigured' }]);
		const bare = openDb(':memory:');
		expect(await health({ token: 't', database: database({ status: 'ready', db: bare }) })).toEqual([503, { token: true, database: 'unmigrated' }]);
	});
});
