import { describe, expect, it } from 'vitest';
import { describeProbe, isProductionDeploy, judgeSync, withRetries } from './canary.ts';

const vercel = { context: 'Vercel', state: 'success' };

describe('canary', () => {
	it('treats only a successful Vercel status on a main commit as a production deploy', () => {
		expect(isProductionDeploy({ ...vercel, branches: [{ name: 'main' }, { name: 'ws10-canary-budgets' }] })).toBe(true);
		expect(isProductionDeploy({ ...vercel, branches: [{ name: 'ws5f-session-replace' }] })).toBe(false);
		expect(isProductionDeploy({ ...vercel, branches: [] })).toBe(false);
		expect(isProductionDeploy({ ...vercel })).toBe(false);
		expect(isProductionDeploy({ ...vercel, state: 'pending', branches: [{ name: 'main' }] })).toBe(false);
		expect(isProductionDeploy({ context: 'ci', state: 'success', branches: [{ name: 'main' }] })).toBe(false);
	});

	it('passes sync only on 200 with exactly token true and database ready', () => {
		expect(judgeSync(200, { token: true, database: 'ready' })).toBe(true);
		expect(judgeSync(200, { database: 'ready', token: true })).toBe(true);
		expect(judgeSync(503, { token: true, database: 'ready' })).toBe(false);
		expect(judgeSync(200, { token: false, database: 'ready' })).toBe(false);
		expect(judgeSync(200, { token: 'true', database: 'ready' })).toBe(false);
		expect(judgeSync(200, { token: true, database: 'unmigrated' })).toBe(false);
		expect(judgeSync(200, { token: true, database: 'ready', reason: 'x' })).toBe(false);
		expect(judgeSync(200, [])).toBe(false);
		expect(judgeSync(200, null)).toBe(false);
		expect(judgeSync(200, undefined)).toBe(false);
	});

	it('prints the status and keys, never values', () => {
		const line = describeProbe({ path: '/api/sync', status: 503, keys: ['database', 'reason', 'token'], ok: false });
		expect(line).toBe('FAIL GET /api/sync -> 503 keys: database, reason, token');
		expect(describeProbe({ path: '/', status: 200, keys: [], ok: true })).toBe('ok   GET / -> 200');
	});

	it('retries with backoff until a probe passes, then stops', async () => {
		const slept: number[] = [];
		const results = [false, false, true, true];
		const tries = await withRetries(async () => ({ ok: results.shift()! }), [1, 2, 3], async (ms) => void slept.push(ms));
		expect(tries.map(({ ok }) => ok)).toEqual([false, false, true]);
		expect(slept).toEqual([1, 2]);
	});

	it('gives up after the last backoff', async () => {
		const tries = await withRetries(async () => ({ ok: false }), [1, 2], async () => {});
		expect(tries).toHaveLength(3);
	});
});
