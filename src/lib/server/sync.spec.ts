import { describe, expect, it } from 'vitest';
import { openDb } from './db/client.ts';
import { bearerMatches, handleSync, syncHealth } from './sync.ts';

describe('bearerMatches', () => {
	it('accepts only the exact bearer token', () => {
		expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
		expect(bearerMatches('Bearer s3cret2', 's3cret')).toBe(false);
		expect(bearerMatches('s3cret', 's3cret')).toBe(false);
		expect(bearerMatches(null, 's3cret')).toBe(false);
	});
});

describe('handleSync', () => {
	it('fails closed with 503 when the database is not configured', async () => {
		const response = await handleSync(new Request('http://app.test', { method: 'POST' }), { token: 't', db: () => undefined });
		expect(response.status).toBe(503);
	});
});

describe('syncHealth', () => {
	it('says unmigrated when log_entries is missing', async () => {
		const db = openDb(':memory:');
		const response = await syncHealth({ token: 't', db: () => db });
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ token: true, database: 'unmigrated' });
	});
});
