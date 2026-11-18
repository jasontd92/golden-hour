import { describe, expect, it } from 'vitest';
import { commitOf, describeProbe, isIgnoredBuild, isProductionDeploy, judgeSync, planRun, withRetries } from './canary.ts';

const vercel = { context: 'Vercel', state: 'success' };
const sha = 'fa1eade47b73733d6312d5abfad33ce9e4068081';
const older = '3f12a6e0c1d2b3a4958677a8b9c0d1e2f3a4b5c6';
const ready = { token: true, database: 'ready', commit: sha };
const deployed = { ...vercel, sha, description: 'Deployment has completed', branches: [{ name: 'main' }] };

describe('canary', () => {
	it('treats only a successful Vercel status on a main commit as a production deploy', () => {
		expect(isProductionDeploy({ ...vercel, branches: [{ name: 'main' }, { name: 'ws10-canary-budgets' }] })).toBe(true);
		expect(isProductionDeploy({ ...vercel, branches: [{ name: 'ws5f-session-replace' }] })).toBe(false);
		expect(isProductionDeploy({ ...vercel, branches: [] })).toBe(false);
		expect(isProductionDeploy({ ...vercel })).toBe(false);
		expect(isProductionDeploy({ ...vercel, state: 'pending', branches: [{ name: 'main' }] })).toBe(false);
		expect(isProductionDeploy({ context: 'ci', state: 'success', branches: [{ name: 'main' }] })).toBe(false);
	});

	it('passes sync only on 200 with exactly token true, database ready and, if present, a commit sha', () => {
		expect(judgeSync(200, ready)).toBe(true);
		expect(judgeSync(200, { commit: sha, database: 'ready', token: true })).toBe(true);
		expect(judgeSync(200, { token: true, database: 'ready' })).toBe(true);
		expect(judgeSync(200, { token: true, database: 'ready', commit: undefined })).toBe(false);
		expect(judgeSync(200, { ...ready, commit: 'fa1eade' })).toBe(false);
		expect(judgeSync(200, { ...ready, commit: sha.toUpperCase() })).toBe(false);
		expect(judgeSync(200, { ...ready, commit: 1 })).toBe(false);
		expect(judgeSync(503, ready)).toBe(false);
		expect(judgeSync(200, { ...ready, token: false })).toBe(false);
		expect(judgeSync(200, { ...ready, token: 'true' })).toBe(false);
		expect(judgeSync(200, { ...ready, database: 'unmigrated' })).toBe(false);
		expect(judgeSync(200, { ...ready, reason: 'x' })).toBe(false);
		expect(judgeSync(200, [])).toBe(false);
		expect(judgeSync(200, null)).toBe(false);
		expect(judgeSync(200, undefined)).toBe(false);
	});

	it('passes a deploy run only once production serves the deployed commit', () => {
		expect(judgeSync(200, ready, sha)).toBe(true);
		expect(judgeSync(200, { ...ready, commit: older }, sha)).toBe(false);
		expect(judgeSync(200, { token: true, database: 'ready' }, sha)).toBe(false);
		expect(judgeSync(200, { ...ready, reason: 'x' }, sha)).toBe(false);
		expect(judgeSync(503, ready, sha)).toBe(false);
		expect(judgeSync(200, { ...ready, token: false }, sha)).toBe(false);
	});

	it('reads only a full lowercase sha as the commit', () => {
		expect(commitOf(ready)).toBe(sha);
		expect(commitOf({ commit: 'main' })).toBeUndefined();
		expect(commitOf({ token: true })).toBeUndefined();
		expect(commitOf(null)).toBeUndefined();
	});

	it('waits for the deployed commit, skips ignored builds, and probes as-is when not a deploy', () => {
		expect(planRun(undefined)).toEqual({});
		expect(planRun(deployed)).toEqual({ expectedCommit: sha });
		expect(isIgnoredBuild({ ...deployed, description: 'Canceled by Ignored Build Step' })).toBe(true);
		expect(isIgnoredBuild(deployed)).toBe(false);
		expect(planRun({ ...deployed, description: 'Canceled by Ignored Build Step' })).toEqual({ skip: `ignored build; ${sha} was not deployed, so production still serves an earlier build` });
		expect(planRun({ ...deployed, branches: [{ name: 'ws5f-session-replace' }] })).toHaveProperty('skip');
		expect(planRun({ ...deployed, sha: undefined })).toEqual({ fail: 'the status event has no commit sha to wait for' });
	});

	it('prints the status and keys, never values', () => {
		const line = describeProbe({ path: '/api/sync', status: 503, keys: ['database', 'reason', 'token'], ok: false });
		expect(line).toBe('FAIL GET /api/sync -> 503 keys: database, reason, token');
		expect(describeProbe({ path: '/', status: 200, keys: [], ok: true })).toBe('ok   GET / -> 200');
		expect(describeProbe({ path: '/api/sync', status: 200, keys: ['commit', 'database', 'token'], commit: sha, ok: true })).toBe(`ok   GET /api/sync -> 200 keys: commit, database, token commit: ${sha}`);
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
