import { execFileSync } from 'node:child_process';

export type Run = (cmd: string, args: string[]) => string | null;

export interface PrStats {
	number: number;
	files: string[];
	ciRunsToGreen: number | null;
	ciRuns: number;
	reviewThreads: number;
	reverts: number;
}

export function runCommand(cwd: string): Run {
	return (cmd, args) => {
		try {
			return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
		} catch {
			return null;
		}
	};
}

function parseJson(text: string | null): unknown {
	if (text === null) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export function commitFiles(run: Run, sha: string): string[] {
	return (run('git', ['show', '--name-only', '--format=', sha]) ?? '').split('\n').filter(Boolean);
}

export function revertCommits(run: Run): string[][] {
	const log = run('git', ['log', 'origin/main', '--format=%x00%s', '--name-only']);
	if (log === null) return [];
	return log
		.split('\0')
		.map((entry) => entry.split('\n').filter(Boolean))
		.filter(([subject]) => subject !== undefined && /^revert\b/i.test(subject))
		.map(([, ...files]) => files);
}

export function ghAvailable(run: Run): boolean {
	return run('gh', ['auth', 'status']) !== null;
}

export function runsUntilGreen(runs: unknown): { toGreen: number | null; total: number } {
	if (!Array.isArray(runs)) return { toGreen: null, total: 0 };
	const sorted = runs
		.filter(isObject)
		.map((run) => ({ at: String(run.createdAt ?? ''), conclusion: run.conclusion }))
		.sort((a, b) => a.at.localeCompare(b.at));
	const green = sorted.findIndex((run) => run.conclusion === 'success');
	return { toGreen: green === -1 ? null : green + 1, total: sorted.length };
}

const threadsQuery =
	'query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads{totalCount}}}}';

function reviewThreadCount(run: Run, pr: number): number {
	const data = parseJson(
		run('gh', [
			'api',
			'graphql',
			'-f',
			`query=${threadsQuery}`,
			'-F',
			'owner={owner}',
			'-F',
			'repo={repo}',
			'-F',
			`number=${pr}`
		])
	);
	const count = isObject(data) && isObject(data.data) ? data.data : null;
	const repository = count && isObject(count.repository) ? count.repository : null;
	const pull = repository && isObject(repository.pullRequest) ? repository.pullRequest : null;
	const threads = pull && isObject(pull.reviewThreads) ? pull.reviewThreads.totalCount : 0;
	return typeof threads === 'number' ? threads : 0;
}

export function prStats(run: Run, pr: number, reverts: string[][]): PrStats | null {
	const view = parseJson(run('gh', ['pr', 'view', String(pr), '--json', 'headRefName,files']));
	if (!isObject(view) || typeof view.headRefName !== 'string') return null;
	const files = Array.isArray(view.files)
		? view.files.filter(isObject).flatMap((file) => (typeof file.path === 'string' ? [file.path] : []))
		: [];
	const runs = parseJson(
		run('gh', [
			'run',
			'list',
			'--branch',
			view.headRefName,
			'--event',
			'pull_request',
			'--limit',
			'200',
			'--json',
			'conclusion,createdAt'
		])
	);
	const ci = runsUntilGreen(runs);
	return {
		number: pr,
		files,
		ciRunsToGreen: ci.toGreen,
		ciRuns: ci.total,
		reviewThreads: reviewThreadCount(run, pr),
		reverts: reverts.filter((touched) => touched.some((file) => files.includes(file))).length
	};
}
