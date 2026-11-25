import { execFileSync, spawnSync } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const runsDir = 'verification/runs';
export const escapesDir = 'verification/escapes';

export interface Catch {
	by: string;
	what: string;
	commit: string;
}

export interface Cost {
	by: string;
	runs: number;
	minutes: number;
}

export interface Run {
	commit: string;
	name: string;
	conclusion: string;
	minutes: number;
}

// why: GitHub keeps check runs, so CI needs no stored record; local and agent checks leave nothing behind unless they write one when they run
export interface RunRecord {
	at: string;
	by: string;
	result: 'pass' | 'fail' | 'blocked';
	minutes?: number;
	tokens?: number;
	usd?: number;
	pr?: number;
	caught?: number;
	detail?: string;
}

export interface Escape {
	at: string;
	what: string;
	found_by: string;
	should_have_caught: string;
	introduced_in?: number;
}

// why: a check must earn its cost; GitHub bills each job rounded up to a whole minute
export function programmaticCosts(runs: Run[]): Cost[] {
	const costs = new Map<string, Cost>();
	for (const { name, conclusion, minutes } of runs) {
		if (conclusion === 'skipped') continue;
		const cost = costs.get(name) ?? { by: name, runs: 0, minutes: 0 };
		cost.runs++;
		cost.minutes += Math.ceil(minutes);
		costs.set(name, cost);
	}
	return [...costs.values()].sort((a, b) => a.by.localeCompare(b.by));
}

// why: one catch per bug, a run of failing commits ended by a later passing commit; a re-run that passes on the same commit is a flake, so it counts as a pass.
export function programmaticCatches(runs: Run[]): Catch[] {
	const commits = [...new Set(runs.map(({ commit }) => commit))];
	const names = [...new Set(runs.map(({ name }) => name))];
	const catches: Catch[] = [];
	for (const name of names) {
		let streak: string[] = [];
		for (const commit of commits) {
			const results = runs.filter((run) => run.name === name && run.commit === commit).map(({ conclusion }) => conclusion);
			if (results.includes('success')) {
				if (streak.length > 0) {
					const span = streak.length > 1 ? `${streak[0]!.slice(0, 7)}..${streak.at(-1)!.slice(0, 7)}` : streak[0]!.slice(0, 7);
					catches.push({ by: name, what: `failed at ${span}, passed at ${commit.slice(0, 7)}`, commit: streak[0]! });
				}
				streak = [];
			} else if (results.includes('failure')) streak.push(commit);
		}
	}
	return catches;
}

export interface Tally {
	by: string;
	catches: number;
	runs: number;
	failed: number;
	blocked: number;
	minutes: number;
	tokens: number;
	usd: number;
	escapes: number;
}

// why: each kind of verification must prove its value against its cost; escapes are charged to the check that should have caught them
export function summarize(catches: Catch[], costs: Cost[], records: RunRecord[], escapes: Escape[]): Tally[] {
	const tallies = new Map<string, Tally>();
	const tally = (by: string) =>
		tallies.get(by) ?? tallies.set(by, { by, catches: 0, runs: 0, failed: 0, blocked: 0, minutes: 0, tokens: 0, usd: 0, escapes: 0 }).get(by)!;
	for (const { by } of catches) tally(by).catches++;
	for (const { by, runs, minutes } of costs) {
		tally(by).runs += runs;
		tally(by).minutes += minutes;
	}
	for (const record of records) {
		const t = tally(record.by);
		t.runs++;
		t.catches += record.caught ?? 0;
		if (record.result === 'fail') t.failed++;
		if (record.result === 'blocked') t.blocked++;
		t.minutes += record.minutes ?? 0;
		t.tokens += record.tokens ?? 0;
		t.usd += record.usd ?? 0;
	}
	for (const { should_have_caught } of escapes) tally(should_have_caught).escapes++;
	return [...tallies.values()].sort((a, b) => b.catches - a.catches || b.escapes - a.escapes || a.by.localeCompare(b.by));
}

export function mutationScore(report: { files: Record<string, { mutants: { status: string }[] }> }): number {
	const statuses = Object.values(report.files).flatMap((file) => file.mutants.map(({ status }) => status));
	const detected = statuses.filter((status) => status === 'Killed' || status === 'Timeout').length;
	const valid = statuses.filter((status) => !['CompileError', 'RuntimeError', 'Ignored'].includes(status)).length;
	return valid === 0 ? 0 : Math.round((detected / valid) * 1000) / 10;
}

const stamp = (at: string) => at.replace(/[:.]/g, '-');

export function writeRecord(root: string, record: RunRecord): string {
	const file = path.join(root, runsDir, `${stamp(record.at)}-${record.by}.json`);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(record, null, '\t') + '\n');
	return file;
}

const readAll = <T>(dir: string): T[] => globSync(`${dir}/*.json`).map((file) => JSON.parse(readFileSync(file, 'utf8')) as T);
const gh = (...args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });
const flag = (args: string[], name: string) => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};
const number = (args: string[], name: string) => {
	const value = flag(args, name);
	if (value === undefined && !args.includes(`--${name}`)) return undefined;
	const parsed = Number(value);
	if (value === undefined || value.trim() === '' || !Number.isFinite(parsed)) throw new Error(`--${name} needs a number, got ${JSON.stringify(value ?? '')}`);
	return parsed;
};

function ciHistory(prs: number): { catches: Catch[]; costs: Cost[] } {
	const numbers = gh('pr', 'list', '--state', 'merged', '--limit', String(prs), '--json', 'number', '-q', '.[].number').split('\n').filter(Boolean);
	const catches: Catch[] = [];
	const costs: Cost[] = [];
	for (const pr of numbers) {
		const shas = gh('api', `repos/{owner}/{repo}/pulls/${pr}/commits`, '--paginate', '-q', '.[].sha').split('\n').filter(Boolean);
		const runs: Run[] = shas.flatMap((commit) =>
			(JSON.parse(gh('api', `repos/{owner}/{repo}/commits/${commit}/check-runs?per_page=100`, '-q', '[.check_runs[] | {name, conclusion, started_at, completed_at}]')) as { name: string; conclusion: string; started_at: string; completed_at: string | null }[])
				.filter((run) => run.completed_at)
				.map(({ name, conclusion, started_at, completed_at }) => ({ commit, name, conclusion, minutes: (Date.parse(completed_at!) - Date.parse(started_at)) / 60_000 }))
		);
		catches.push(...programmaticCatches(runs));
		costs.push(...programmaticCosts(runs));
	}
	return { catches, costs };
}

if (import.meta.main) {
	const argv = process.argv.slice(2);
	const mode = argv[0] === undefined || argv[0].startsWith('--') ? 'report' : argv[0];
	const args = mode === 'report' && argv[0] !== 'report' ? argv : argv.slice(1);
	if (!['run', 'agent', 'escape', 'report'].includes(mode)) throw new Error(`unknown mode "${mode}": use run, agent, escape or report`);
	const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
	const at = new Date().toISOString();
	if (mode === 'run') {
		const [by, separator, command, ...rest] = args;
		if (!by || separator !== '--' || !command) throw new Error('usage: node scripts/ledger.ts run <name> -- <command...>');
		const start = performance.now();
		const { status } = spawnSync(command, rest, { stdio: 'inherit' });
		const minutes = Math.round((performance.now() - start) / 600) / 100;
		const report = path.join(root, 'reports/mutation/mutation.json');
		const detail = by === 'mutation' && status === 0 ? `score ${mutationScore(JSON.parse(readFileSync(report, 'utf8')))}%` : undefined;
		console.log(`recorded ${path.relative(root, writeRecord(root, { at, by, result: status === 0 ? 'pass' : 'fail', minutes, ...(detail ? { detail } : {}) }))}`);
		process.exitCode = status ?? 1;
	} else if (mode === 'agent') {
		const [by] = args;
		if (!by) throw new Error('usage: node scripts/ledger.ts agent <name> --tokens N [--caught N] [--usd X] [--minutes M] [--pr N] [--detail "..."]');
		const record: RunRecord = { at, by, result: 'pass', caught: number(args, 'caught'), tokens: number(args, 'tokens'), usd: number(args, 'usd'), minutes: number(args, 'minutes'), pr: number(args, 'pr'), detail: flag(args, 'detail') };
		console.log(`recorded ${path.relative(root, writeRecord(root, JSON.parse(JSON.stringify(record)) as RunRecord))}`);
	} else if (mode === 'escape') {
		const [what] = args;
		const foundBy = flag(args, 'found-by');
		const shouldHave = flag(args, 'should-have-caught');
		if (!what || !foundBy || !shouldHave) throw new Error('usage: node scripts/ledger.ts escape "<what>" --found-by <who> --should-have-caught <check> [--introduced-in <pr>]');
		const escape: Escape = { at, what, found_by: foundBy, should_have_caught: shouldHave, ...(args.includes('--introduced-in') ? { introduced_in: number(args, 'introduced-in') } : {}) };
		const file = path.join(root, escapesDir, `${stamp(at)}.json`);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(escape, null, '\t') + '\n');
		console.log(`recorded ${path.relative(root, file)}`);
	} else {
		const prs = Number(flag(args, 'prs') ?? 30);
		const { catches, costs } = ciHistory(prs);
		const records = readAll<RunRecord>(path.join(root, runsDir));
		const escapes = readAll<Escape>(path.join(root, escapesDir));
		console.log(`CI: last ${prs} merged PRs. Local and agent runs: ${records.length}. Escapes: ${escapes.length}.`);
		console.log('catches: CI = runs of failures fixed by a later commit; agents = findings that led to a fix.');
		console.log('check | catches | runs | failed | blocked | minutes | tokens | usd | escapes');
		for (const t of summarize(catches, costs, records, escapes)) {
			console.log(`${t.by} | ${t.catches} | ${t.runs} | ${t.failed} | ${t.blocked} | ${Math.round(t.minutes)} | ${t.tokens} | ${t.usd.toFixed(2)} | ${t.escapes}`);
		}
	}
}
