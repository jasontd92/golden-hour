import { readFileSync } from 'node:fs';

export const production = 'https://golden-hour-iota-three.vercel.app';

export interface CommitStatusEvent {
	context?: string;
	state?: string;
	branches?: { name: string }[];
}

// why: Vercel reports deploys here as commit statuses, not GitHub deployments; a deploy whose commit is on main is the production deploy.
export function isProductionDeploy(event: CommitStatusEvent): boolean {
	return event.context === 'Vercel' && event.state === 'success' && (event.branches ?? []).some(({ name }) => name === 'main');
}

export interface Probe {
	path: string;
	status: number;
	keys: string[];
	ok: boolean;
}

export function judgeSync(status: number, body: unknown): boolean {
	if (status !== 200 || typeof body !== 'object' || body === null || Array.isArray(body)) return false;
	const fields = body as Record<string, unknown>;
	return Object.keys(fields).sort().join() === 'database,token' && fields.token === true && fields.database === 'ready';
}

export const describeProbe = ({ path, status, keys, ok }: Probe) =>
	`${ok ? 'ok  ' : 'FAIL'} GET ${path} -> ${status}${keys.length > 0 ? ` keys: ${keys.join(', ')}` : ''}`;

async function probe(origin: string, path: string): Promise<Probe> {
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
	return { path, status, keys, ok: path === '/api/sync' ? judgeSync(status, body) : status === 200 };
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

if (import.meta.main) {
	const event = process.env.GITHUB_EVENT_NAME === 'status' ? (JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')) as CommitStatusEvent) : undefined;
	if (event && !isProductionDeploy(event)) {
		console.log(`skipped: a ${event.context} ${event.state} status on a commit outside main is not a production deploy`);
	} else {
		let ok = true;
		for (const path of ['/api/sync', '/']) {
			const tries = await withRetries(() => probe(production, path), retryDelaysMs);
			for (const tried of tries) console.log(describeProbe(tried));
			ok &&= tries.at(-1)!.ok;
		}
		if (!ok) process.exitCode = 1;
	}
}
