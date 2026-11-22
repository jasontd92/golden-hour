import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export interface Catch {
	by: string;
	kind: 'programmatic' | 'agent' | 'human';
	what: string;
	real: boolean | null;
	commit?: string;
}

export interface Cost {
	by: string;
	runs: number;
	minutes?: number;
	tokens?: number;
}

export interface Entry {
	pr: number;
	title: string;
	catches: Catch[];
	costs: Cost[];
}

export const ledgerDir = 'verification/ledger';

// why: a check that failed on one commit of a PR and passed on its last commit caught something; a human or agent then marks whether it was real or a flake.
export interface Run {
	commit: string;
	name: string;
	conclusion: string;
	minutes: number;
}

// why: a check must earn its cost; GitHub bills each job rounded up to a whole minute
export function programmaticCosts(runs: Run[]): Cost[] {
	const costs = new Map<string, Cost>();
	for (const { name, conclusion, minutes } of runs) {
		if (conclusion === 'skipped') continue;
		const cost = costs.get(name) ?? { by: name, runs: 0, minutes: 0 };
		cost.runs++;
		cost.minutes! += Math.ceil(minutes);
		costs.set(name, cost);
	}
	return [...costs.values()].sort((a, b) => a.by.localeCompare(b.by));
}

export function programmaticCatches(runs: Run[]): Catch[] {
	const commits = [...new Set(runs.map(({ commit }) => commit))];
	const last = commits.at(-1);
	const passedAtEnd = new Set(runs.filter(({ commit, conclusion }) => commit === last && conclusion === 'success').map(({ name }) => name));
	const seen = new Set<string>();
	return runs
		.filter(({ name, conclusion, commit }) => conclusion === 'failure' && commit !== last && passedAtEnd.has(name))
		.filter(({ name, commit }) => !seen.has(name + commit) && seen.add(name + commit))
		.map(({ name, commit }) => ({ by: name, kind: 'programmatic', what: `failed at ${commit.slice(0, 7)}, passed by the last commit`, real: null, commit }));
}

export interface Tally {
	by: string;
	real: number;
	flake: number;
	unclassified: number;
	runs: number;
	minutes: number;
	tokens: number;
}

// why: each kind of verification must prove its value against its cost; one with no real catches is a candidate to remove
export function summarize(entries: Entry[]): Tally[] {
	const tallies = new Map<string, Tally>();
	const tally = (by: string) => tallies.get(by) ?? tallies.set(by, { by, real: 0, flake: 0, unclassified: 0, runs: 0, minutes: 0, tokens: 0 }).get(by)!;
	for (const { by, real } of entries.flatMap((entry) => entry.catches)) {
		const t = tally(by);
		if (real === true) t.real++;
		else if (real === false) t.flake++;
		else t.unclassified++;
	}
	for (const { by, runs, minutes, tokens } of entries.flatMap((entry) => entry.costs ?? [])) {
		const t = tally(by);
		t.runs += runs;
		t.minutes += minutes ?? 0;
		t.tokens += tokens ?? 0;
	}
	return [...tallies.values()].sort((a, b) => b.real - a.real || a.by.localeCompare(b.by));
}

const gh = (...args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });

if (import.meta.main) {
	const [mode, pr] = process.argv.slice(2);
	if (mode === 'draft' && pr) {
		const title = gh('pr', 'view', pr, '--json', 'title', '-q', '.title').trim();
		const shas = gh('api', `repos/{owner}/{repo}/pulls/${pr}/commits`, '--paginate', '-q', '.[].sha').split('\n').filter(Boolean);
		const runs: Run[] = shas.flatMap((commit) =>
			(JSON.parse(gh('api', `repos/{owner}/{repo}/commits/${commit}/check-runs`, '-q', '[.check_runs[] | {name, conclusion, started_at, completed_at}]')) as { name: string; conclusion: string; started_at: string; completed_at: string | null }[])
				.filter((run) => run.completed_at)
				.map(({ name, conclusion, started_at, completed_at }) => ({ commit, name, conclusion, minutes: (Date.parse(completed_at!) - Date.parse(started_at)) / 60_000 }))
		);
		const file = `${ledgerDir}/${pr}.json`;
		const existing = (() => {
			try {
				return JSON.parse(readFileSync(file, 'utf8')) as Entry;
			} catch {
				return undefined;
			}
		})();
		const known = new Set((existing?.catches ?? []).map((c) => `${c.by}@${c.commit ?? ''}`));
		const agentCosts = (existing?.costs ?? []).filter((cost) => cost.tokens !== undefined);
		const entry: Entry = {
			pr: Number(pr),
			title,
			catches: [...(existing?.catches ?? []), ...programmaticCatches(runs).filter((c) => !known.has(`${c.by}@${c.commit}`))],
			costs: [...programmaticCosts(runs), ...agentCosts]
		};
		mkdirSync(ledgerDir, { recursive: true });
		writeFileSync(file, JSON.stringify(entry, null, '\t') + '\n');
		console.log(`${file}: ${entry.catches.length} catch(es); set "real" on each, and add agent or human catches and agent token costs`);
	} else {
		const entries = globSync(`${ledgerDir}/*.json`).map((file) => JSON.parse(readFileSync(file, 'utf8')) as Entry);
		console.log(`${entries.length} PR(s) in ${ledgerDir}`);
		console.log('check | real | flake | unclassified | runs | CI min | tokens | cost per real catch');
		for (const t of summarize(entries)) {

			const perCatch = t.real > 0 ? [t.minutes && `${Math.round(t.minutes / t.real)} min`, t.tokens && `${Math.round(t.tokens / t.real)} tokens`].filter(Boolean).join(' + ') || '-' : 'no real catches yet';
			console.log(`${t.by} | ${t.real} | ${t.flake} | ${t.unclassified} | ${t.runs} | ${t.minutes} | ${t.tokens} | ${perCatch}`);

		}
	}
}
