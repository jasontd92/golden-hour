import { readFileSync } from 'node:fs';

export const production = 'https://golden-hour-iota-three.vercel.app';

export interface CommitStatusEvent {
	context?: string;
	state?: string;
	description?: string;
	sha?: string;
	branches?: { name: string }[];
}

// why: Vercel reports deploys here as commit statuses, not GitHub deployments; a deploy whose commit is on main is the production deploy.
export function isProductionDeploy(event: CommitStatusEvent): boolean {
	return event.context === 'Vercel' && event.state === 'success' && (event.branches ?? []).some(({ name }) => name === 'main');
}

// why: Vercel still posts success when the Ignored Build Step skips a commit, so that commit never reaches production
export const isIgnoredBuild = (event: CommitStatusEvent) => /ignored build step/i.test(event.description ?? '');

export interface Probe {
	path: string;
	status: number;
	keys: string[];
	commit?: string;
	ok: boolean;
}

const sha = /^[0-9a-f]{40}$/;

export const commitOf = (body: unknown) => {
	const commit = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).commit : undefined;
	return typeof commit === 'string' && sha.test(commit) ? commit : undefined;
};

// why: only a deploy run knows which commit must be live; other runs also pass a build that predates the commit field
export function judgeSync(status: number, body: unknown, expectedCommit?: string): boolean {
	if (status !== 200 || typeof body !== 'object' || body === null || Array.isArray(body)) return false;
	const fields = body as Record<string, unknown>;
	const keys = Object.keys(fields).sort().join();
	const healthy = fields.token === true && fields.database === 'ready';
	if (expectedCommit !== undefined) return healthy && keys === 'commit,database,token' && commitOf(body) === expectedCommit;
	return healthy && (keys === 'database,token' || (keys === 'commit,database,token' && commitOf(body) !== undefined));
}

export const describeProbe = ({ path, status, keys, commit, ok }: Probe) =>
	`${ok ? 'ok  ' : 'FAIL'} GET ${path} -> ${status}${keys.length > 0 ? ` keys: ${keys.join(', ')}` : ''}${commit ? ` commit: ${commit}` : ''}`;

async function probe(origin: string, path: string, expectedCommit?: string): Promise<Probe> {
	let status = 0;
	let body: unknown;
	try {
		const response = await fetch(origin + path, { redirect: 'manual', headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
		status = response.status;
		body = path === '/api/sync' ? await response.json().catch(() => undefined) : undefined;
	} catch {
		body = undefined;
	}
	const keys = typeof body === 'object' && body !== null && !Array.isArray(body) ? Object.keys(body).sort() : [];
	const commit = commitOf(body);
	return { path, status, keys, ...(commit ? { commit } : {}), ok: path === '/api/sync' ? judgeSync(status, body, expectedCommit) : status === 200 };
}

export async function withRetries<T extends { ok: boolean }>(attempt: () => Promise<T>, delaysMs: number[], sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<T[]> {
	const tries: T[] = [await attempt()];
	for (const delay of delaysMs) {
		if (tries.at(-1)!.ok) break;
		await sleep(delay);
		tries.push(await attempt());
	}
	return tries;
}

export const retryDelaysMs = [2000, 5000, 10000];

// why: the status can land before production's alias serves the new build, so a deploy run waits up to ~3 min for its commit
export const deployDelaysMs = [2000, 5000, 10000, 20000, 30000, 30000, 30000, 30000, 30000];

export type Run = { skip: string } | { fail: string } | { expectedCommit?: string };

export function planRun(event: CommitStatusEvent | undefined): Run {
	if (!event) return {};
	if (!isProductionDeploy(event)) return { skip: `a ${event.context} ${event.state} status on a commit outside main is not a production deploy` };
	const expectedCommit = event.sha && sha.test(event.sha) ? event.sha : undefined;
	if (isIgnoredBuild(event)) return { skip: `ignored build; ${expectedCommit ?? 'this commit'} was not deployed, so production still serves an earlier build` };
	if (!expectedCommit) return { fail: 'the status event has no commit sha to wait for' };
	return { expectedCommit };
}

if (import.meta.main) {
	const event = process.env.GITHUB_EVENT_NAME === 'status' ? (JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')) as CommitStatusEvent) : undefined;
	const run = planRun(event);
	if ('skip' in run) {
		console.log(`skipped: ${run.skip}`);
	} else if ('fail' in run) {
		console.log(`FAIL ${run.fail}`);
		process.exitCode = 1;
	} else {
		const { expectedCommit } = run;
		if (expectedCommit) console.log(`waiting for production to serve ${expectedCommit}`);
		let ok = true;
		for (const path of ['/api/sync', '/']) {
			const sync = path === '/api/sync';
			const tries = await withRetries(() => probe(production, path, sync ? expectedCommit : undefined), sync && expectedCommit ? deployDelaysMs : retryDelaysMs);
			for (const tried of tries) console.log(describeProbe(tried));
			ok &&= tries.at(-1)!.ok;
		}
		if (!ok) process.exitCode = 1;
	}
}
