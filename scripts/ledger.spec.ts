import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type Catch, type Cost, type Escape, type Run, type RunRecord, mutationScore, programmaticCatches, programmaticCosts, summarize, writeRecord } from './ledger.ts';

// why: real check runs from jasontd92/golden-hour, in PR commit order, as gh api commits/<sha>/check-runs returned them
type CapturedRun = { commit: string; name: string; conclusion: string | null; started_at: string; completed_at: string | null };
const captured = JSON.parse(readFileSync(new URL('./fixtures/oracle/check-runs.json', import.meta.url), 'utf8')) as Record<string, CapturedRun[]>;
const runsOf = (pr: string): Run[] =>
	captured[pr]!.filter((run) => run.completed_at).map(({ commit, name, conclusion, started_at, completed_at }) => ({ commit, name, conclusion: conclusion!, minutes: (Date.parse(completed_at!) - Date.parse(started_at)) / 60_000 }));
// why: the six records migrated from the hand-kept ledger, frozen as committed in verification/runs/ at ff5aa50, since the live directory grows with every recorded run
const recordsIn = (dir: URL) =>
	readdirSync(dir)
		.filter((file) => file.endsWith('.json'))
		.sort()
		.map((file) => ({ file, record: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as RunRecord }));
const migratedDir = new URL('./fixtures/oracle/runs/', import.meta.url);
const migrated = recordsIn(migratedDir);
// why: the live records, which only grow; tests over them assert only what stays true as records are added
const liveDir = new URL('../verification/runs/', import.meta.url);
const live = recordsIn(liveDir);
const byName = <T extends { by: string }>(list: T[]) => [...list].sort((a, b) => a.by.localeCompare(b.by));
const run = (commit: string, name: string, conclusion: string, minutes = 1): Run => ({ commit, name, conclusion, minutes });

const scratch = mkdtempSync(path.join(tmpdir(), 'ledger-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let repos = 0;
const repo = () => {
	const dir = path.join(scratch, `repo-${repos++}`);
	mkdirSync(dir, { recursive: true });
	execFileSync('git', ['init', '-q'], { cwd: dir });
	return dir;
};
const jsonIn = <T>(dir: string) => globSync(`${dir}/*.json`).map((file) => ({ file, data: JSON.parse(readFileSync(file, 'utf8')) as T }));

describe('programmaticCatches', () => {
	const keys = (catches: { by: string; commit?: string }[]) => catches.map(({ by, commit }) => `${by}@${commit}`).sort();

	it('gives real PR #37 one catch for its one streak: checks failed 8b1b6ff..e32ecae and passed at 172d15f, so checks@8b1b6ff; rules out one catch per failing commit (4), or crediting the last failing or the passing commit', () => {
		const catches = programmaticCatches(runsOf('37'));
		expect(catches).toHaveLength(1);
		expect(catches[0]).toMatchObject({ by: 'checks', commit: '8b1b6ff1622e261b6a1c97141a93da0ca11d72a2' });
	});

	it('still finds the one real catch in PR #24: evidence failed at 95ca93e and passed at a032f6d', () => {
		const catches = programmaticCatches(runsOf('24'));
		expect(catches).toHaveLength(1);
		expect(catches[0]).toMatchObject({ by: 'evidence', commit: '95ca93e0bc999f7ce3e9b90f2d6398f644c8878a' });
	});

	it('returns a catch as exactly {by, what, commit}, with a non-empty what; rules out keeping the old kind/real classification fields', () => {
		for (const c of [...programmaticCatches(runsOf('37')), ...programmaticCatches(runsOf('24'))]) {
			expect(Object.keys(c).sort()).toEqual(['by', 'commit', 'what']);
			expect(c.what.length).toBeGreaterThan(0);
		}
	});

	it('finds none in PRs #27 and #33, which never failed, nor in #35, whose only commit failed with no later pass; rules out counting a streak still failing at the last commit', () => {
		for (const pr of ['27', '33', '35']) expect(programmaticCatches(runsOf(pr))).toEqual([]);
	});

	it('credits the first failing commit of a streak; rules out the last failing commit or the passing commit', () => {
		expect(keys(programmaticCatches([run('c1', 'unit', 'failure'), run('c2', 'unit', 'failure'), run('c3', 'unit', 'failure'), run('c4', 'unit', 'success')]))).toEqual(['unit@c1']);
	});

	it('gives one catch per streak: fail, pass, fail, pass is two catches at c1 and c3; rules out one catch per check', () => {
		expect(keys(programmaticCatches([run('c1', 'unit', 'failure'), run('c2', 'unit', 'success'), run('c3', 'unit', 'failure'), run('c4', 'unit', 'success')]))).toEqual(['unit@c1', 'unit@c3']);
	});

	it('counts a streak ended by a later pass even when the check fails again at the last commit; rules out the old "must pass on the last commit" rule', () => {
		expect(keys(programmaticCatches([run('c1', 'unit', 'failure'), run('c2', 'unit', 'success'), run('c3', 'unit', 'failure')]))).toEqual(['unit@c1']);
	});

	it('does not count a streak still failing at the last commit; rules out "any failure is a catch"', () => {
		expect(programmaticCatches([run('c1', 'unit', 'success'), run('c2', 'unit', 'failure'), run('c3', 'unit', 'failure')])).toEqual([]);
	});

	it('treats a commit where the check failed and passed (a re-run) as passing, in either run order, so a failure fixed only by a re-run is not a catch; rules out counting the failed attempt', () => {
		expect(programmaticCatches([run('c1', 'e2e', 'failure'), run('c1', 'e2e', 'success'), run('c2', 'e2e', 'success')])).toEqual([]);
		expect(programmaticCatches([run('c1', 'e2e', 'success'), run('c1', 'e2e', 'failure'), run('c2', 'e2e', 'success')])).toEqual([]);
		expect(programmaticCatches([run('c1', 'e2e', 'success'), run('c2', 'e2e', 'failure'), run('c2', 'e2e', 'success')])).toEqual([]);
	});

	it('counts repeated failed runs on one commit once; rules out one catch per run', () => {
		expect(keys(programmaticCatches([run('c1', 'unit', 'failure'), run('c1', 'unit', 'failure'), run('c2', 'unit', 'success')]))).toEqual(['unit@c1']);
	});

	it("judges each check on its own runs; rules out another check's pass ending a streak, or merging streaks across checks", () => {
		expect(programmaticCatches([run('c1', 'unit', 'failure'), run('c2', 'lint', 'success')])).toEqual([]);
		const catches = programmaticCatches([run('c1', 'lint', 'failure'), run('c1', 'unit', 'success'), run('c2', 'unit', 'failure'), run('c2', 'lint', 'failure'), run('c3', 'unit', 'success'), run('c3', 'lint', 'success')]);
		expect(keys(catches)).toEqual(['lint@c1', 'unit@c2']);
	});

	it('does not count a cancelled or skipped run as a failure; rules out "anything but success"', () => {
		expect(programmaticCatches([run('c1', 'e2e', 'cancelled'), run('c1', 'lint', 'skipped'), run('c2', 'e2e', 'success'), run('c2', 'lint', 'success')])).toEqual([]);
	});

	it('takes commit order from run order, not from sorting shas; rules out ordering by sha', () => {
		expect(keys(programmaticCatches([run('zzz', 'unit', 'failure'), run('aaa', 'unit', 'success')]))).toEqual(['unit@zzz']);
		expect(programmaticCatches([run('aaa', 'unit', 'success'), run('zzz', 'unit', 'failure')])).toEqual([]);
	});
});

describe('programmaticCosts', () => {
	it('costs real PR #27 per check: whole minutes rounded up per run, skipped runs excluded; rules out rounding the sum, or counting skips', () => {
		expect(byName(programmaticCosts(runsOf('27')))).toEqual(
			byName([
				{ by: 'evidence', runs: 2, minutes: 2 },
				{ by: 'e2e', runs: 2, minutes: 7 },
				{ by: 'bundle-budget', runs: 4, minutes: 4 },
				{ by: 'sync-budget', runs: 2, minutes: 4 },
				{ by: 'checks', runs: 4, minutes: 8 },
				{ by: 'production', runs: 4, minutes: 4 },
				{ by: 'Vercel Preview Comments', runs: 3, minutes: 0 }
			])
		);
	});

	it('counts a failed run\'s cost (PR #24 evidence failed once, passed once); rules out costing only successes', () => {
		expect(programmaticCosts(runsOf('24')).find(({ by }) => by === 'evidence')).toEqual({ by: 'evidence', runs: 2, minutes: 2 });
	});

	it('rounds up 1.01 to 2 and keeps 3 at 3; rules out Math.round', () => {
		expect(programmaticCosts([run('c1', 'unit', 'success', 1.01), run('c2', 'unit', 'failure', 3)])).toEqual([{ by: 'unit', runs: 2, minutes: 5 }]);
	});
});

describe('summarize', () => {
	const zero = { catches: 0, runs: 0, failed: 0, blocked: 0, minutes: 0, tokens: 0, usd: 0, escapes: 0 };
	const records = migrated.map(({ record }) => record);
	const ci = { catches: [...programmaticCatches(runsOf('37')), ...programmaticCatches(runsOf('24'))], costs: [...programmaticCosts(runsOf('37')), ...programmaticCosts(runsOf('24'))] };

	it('tallies the six real migrated records: oracle 4 runs, 2 caught, 7,106,479 tokens, $5.65, 27.56 min; code-review 2 runs, 5 caught, 140,215 tokens, 3.4 min; rules out ignoring caught, or counting a record as a catch', () => {
		const tallies = summarize([], [], records, []);
		expect(tallies.map(({ by }) => by)).toEqual(['code-review', 'oracle']);
		const [review, oracle] = tallies;
		expect(review).toMatchObject({ by: 'code-review', catches: 5, runs: 2, failed: 0, blocked: 0, tokens: 140_215, usd: 0, escapes: 0 });
		expect(review!.minutes).toBeCloseTo(3.4, 6);
		expect(oracle).toMatchObject({ by: 'oracle', catches: 2, runs: 4, failed: 0, blocked: 0, tokens: 7_106_479, escapes: 0 });
		expect(oracle!.usd).toBeCloseTo(5.65, 6);
		expect(oracle!.minutes).toBeCloseTo(27.56, 6);
	});

	it('adds real CI catches and runs (#37 checks 1 catch/7 runs, #24 evidence 1 catch/2 runs + #37 evidence 1 run) to the same tally as records for that check; rules out keeping CI and records in separate rows', () => {
		const extra: RunRecord[] = [{ at: '2026-11-22T07:00:00.000Z', by: 'checks', result: 'pass', minutes: 2, caught: 1 }];
		const tallies = summarize(ci.catches, ci.costs, extra, []);
		expect(tallies.filter(({ by }) => by === 'checks')).toHaveLength(1);
		const checks = tallies.find(({ by }) => by === 'checks')!;
		const ciMinutes = ci.costs.filter(({ by }) => by === 'checks').reduce((sum, { minutes }) => sum + minutes, 0);
		expect(checks).toEqual({ ...zero, by: 'checks', catches: 2, runs: 8, minutes: ciMinutes + 2 });
		expect(tallies.find(({ by }) => by === 'evidence')).toMatchObject({ catches: 1, runs: 3 });
		expect(tallies.find(({ by }) => by === 'Vercel Preview Comments')).toMatchObject({ catches: 0, runs: 10 });
	});

	it('counts failed and blocked records apart, each still a run; rules out treating every record as a pass, or a block as a failure', () => {
		const tallies = summarize([], [], [
			{ at: 'a', by: 'guard', result: 'blocked', detail: 'scripts/a.spec.ts: committed tests come from the oracle' },
			{ at: 'b', by: 'guard', result: 'blocked', detail: 'checks not green' },
			{ at: 'c', by: 'mutation', result: 'fail', minutes: 4 },
			{ at: 'd', by: 'mutation', result: 'pass', minutes: 5, detail: 'score 71.2%' }
		], []);
		expect(byName(tallies)).toEqual([
			{ ...zero, by: 'guard', runs: 2, blocked: 2 },
			{ ...zero, by: 'mutation', runs: 2, failed: 1, minutes: 9 }
		]);
	});

	it('charges an escape to its should_have_caught check, not its finder, creating a row for a check with no runs; rules out charging found_by', () => {
		const escapes: Escape[] = [
			{ at: 'x', what: 'stale cache after deploy', found_by: 'canary', should_have_caught: 'e2e', introduced_in: 35 },
			{ at: 'y', what: 'wrong sunrise in Reykjavik', found_by: 'jason', should_have_caught: 'oracle' },
			{ at: 'z', what: 'second wrong sunrise', found_by: 'jason', should_have_caught: 'oracle' }
		];
		const tallies = summarize([], [{ by: 'e2e', runs: 2, minutes: 7 }], records, escapes);
		expect(tallies.find(({ by }) => by === 'e2e')).toEqual({ ...zero, by: 'e2e', runs: 2, minutes: 7, escapes: 1 });
		expect(tallies.find(({ by }) => by === 'oracle')).toMatchObject({ escapes: 2, catches: 2 });
		expect(tallies.find(({ by }) => by === 'canary')).toBeUndefined();
		expect(tallies.find(({ by }) => by === 'jason')).toBeUndefined();
	});

	it('orders by catches, then escapes, then name; rules out ordering by runs, cost or insertion', () => {
		const catches: Catch[] = [{ by: 'zeta', what: 'w', commit: 'c1' }, { by: 'zeta', what: 'w', commit: 'c2' }, { by: 'beta', what: 'w', commit: 'c3' }];
		const costs: Cost[] = [{ by: 'alpha', runs: 99, minutes: 500 }, { by: 'gamma', runs: 1, minutes: 1 }, { by: 'delta', runs: 1, minutes: 1 }, { by: 'beta', runs: 1, minutes: 1 }];
		const escapes: Escape[] = [{ at: 'a', what: 'w', found_by: 'f', should_have_caught: 'gamma' }, { at: 'b', what: 'w', found_by: 'f', should_have_caught: 'delta' }, { at: 'c', what: 'w', found_by: 'f', should_have_caught: 'delta' }, { at: 'd', what: 'w', found_by: 'f', should_have_caught: 'beta' }];
		const records: RunRecord[] = [{ at: 'e', by: 'alpha', result: 'pass', tokens: 9_000_000, usd: 50 }];
		expect(summarize(catches, costs, records, escapes).map(({ by }) => by)).toEqual(['zeta', 'beta', 'delta', 'gamma', 'alpha']);
		expect(summarize([], [{ by: 'b', runs: 1, minutes: 1 }, { by: 'a', runs: 1, minutes: 1 }], [], []).map(({ by }) => by)).toEqual(['a', 'b']);
	});

	it('returns nothing when there is nothing to report', () => {
		expect(summarize([], [], [], [])).toEqual([]);
	});

	it('counts every live record in verification/runs/ as exactly one run and sums its caught, however many records exist; rules out dropping, double-counting or misreading a real recorded run', () => {
		const tallies = summarize([], [], live.map(({ record }) => record), []);
		expect(tallies.reduce((sum, { runs }) => sum + runs, 0)).toBe(live.length);
		expect(tallies.reduce((sum, { catches }) => sum + catches, 0)).toBe(live.reduce((sum, { record }) => sum + (record.caught ?? 0), 0));
		expect(new Set(tallies.map(({ by }) => by))).toEqual(new Set(live.map(({ record }) => record.by)));
	});
});

describe('mutationScore (Stryker mutation.json)', () => {
	const report = (...files: string[][]) => ({ files: Object.fromEntries(files.map((statuses, i) => [`src/lib/f${i}.ts`, { language: 'typescript', source: '', mutants: statuses.map((status, id) => ({ id: String(id), mutatorName: 'ConditionalExpression', status, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } })) }])) });
	const times = (status: string, n: number) => Array<string>(n).fill(status);

	it('scores Killed and Timeout over every mutant but CompileError, RuntimeError and Ignored: 5 killed, 1 timeout, 2 survived, 1 no-coverage (6/9) is 66.7; rules out excluding Timeout (55.6), counting the invalid ones (40), or dropping NoCoverage (75)', () => {
		expect(mutationScore(report([...times('Killed', 5), 'Timeout', ...times('Survived', 2), 'NoCoverage', ...times('CompileError', 3), 'RuntimeError', ...times('Ignored', 2)]))).toBe(66.7);
	});

	it('pools mutants across files rather than averaging per file: 1/1 and 1/4 is 40, not 62.5; rules out a per-file mean', () => {
		expect(mutationScore(report(['Killed'], ['Killed', 'Survived', 'Survived', 'Survived']))).toBe(40);
	});

	it('rounds to one decimal: 1/8 is 12.5, 2/3 is 66.7, 1/7 is 14.3; rules out a fraction, two decimals or a whole percent', () => {
		expect(mutationScore(report(['Killed', ...times('Survived', 7)]))).toBe(12.5);
		expect(mutationScore(report(['Killed', 'Timeout', 'Survived']))).toBe(66.7);
		expect(mutationScore(report(['Killed', ...times('Survived', 6)]))).toBe(14.3);
	});

	it('is 0, not NaN, with no files, no mutants, or only CompileError/RuntimeError/Ignored mutants', () => {
		expect(mutationScore({ files: {} })).toBe(0);
		expect(mutationScore(report([]))).toBe(0);
		expect(mutationScore(report(['CompileError', 'RuntimeError', 'Ignored']))).toBe(0);
	});
});

describe('writeRecord', () => {
	it.each(migrated)('writes $file under verification/runs/ for its own record, round-tripping the JSON; rules out a different naming scheme from the migrated records', ({ file, record }) => {
		const root = repo();
		const written = writeRecord(root, record);
		expect(written).toBe(path.join(root, 'verification/runs', file));
		expect(JSON.parse(readFileSync(written, 'utf8'))).toEqual(record);
	});

	it.each(live)('names live record $file as writeRecord would name its own record; rules out a recorded run whose file name disagrees with its at/by', ({ file, record }) => {
		expect(path.basename(writeRecord(repo(), record))).toBe(file);
	});

	it('replaces every : and . in the timestamp with -, so the name is safe on every filesystem; rules out replacing only the first', () => {
		const written = writeRecord(repo(), { at: '2026-12-01T09:05:07.123Z', by: 'proof-sync', result: 'pass', minutes: 0.4 });
		expect(path.basename(written)).toBe('2026-12-01T09-05-07-123Z-proof-sync.json');
	});

	it('creates verification/runs/ when missing and keeps separate files for two checks at the same instant; rules out one shared ledger file', () => {
		const root = repo();
		expect(existsSync(path.join(root, 'verification'))).toBe(false);
		writeRecord(root, { at: '2026-12-01T09:05:07.123Z', by: 'guard', result: 'blocked', detail: 'r' });
		writeRecord(root, { at: '2026-12-01T09:05:07.123Z', by: 'oracle', result: 'pass', tokens: 1 });
		expect(readdirSync(path.join(root, 'verification/runs')).sort()).toEqual(['2026-12-01T09-05-07-123Z-guard.json', '2026-12-01T09-05-07-123Z-oracle.json']);
	});
});

describe('ledger CLI', () => {
	const script = path.resolve('scripts/ledger.ts');
	const bin = path.join(scratch, 'bin');
	mkdirSync(bin, { recursive: true });
	const ledger = (cwd: string, ...args: string[]) => spawnSync('node', [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
	const runs = (root: string) => jsonIn<RunRecord>(path.join(root, 'verification/runs'));
	const stampOf = (at: string) => at.replace(/[:.]/g, '-');

	describe('ledger run <name> -- <command...>', () => {
		it('records a passing command as one pass record named for the check, exit 0; rules out recording nothing or misnaming', () => {
			const root = repo();
			const result = ledger(root, 'run', 'e2e-local', '--', 'node', '-e', '');
			expect(result.status).toBe(0);
			const [only, ...more] = runs(root);
			expect(more).toEqual([]);
			expect(only!.data).toMatchObject({ by: 'e2e-local', result: 'pass' });
			expect(path.basename(only!.file)).toBe(`${stampOf(only!.data.at)}-e2e-local.json`);
			expect(Number.isNaN(Date.parse(only!.data.at))).toBe(false);
		});

		it('passes the exit code through (3) and records fail; rules out exit 0 after recording, or recording pass', () => {
			const root = repo();
			expect(ledger(root, 'run', 'proof-sync', '--', 'node', '-e', 'process.exit(3)').status).toBe(3);
			expect(runs(root).map(({ data }) => data)).toEqual([expect.objectContaining({ by: 'proof-sync', result: 'fail' })]);
		});

		it('passes the arguments to the command unchanged, including one with a space; rules out joining into a shell string', () => {
			const root = repo();
			const out = path.join(root, 'args.json');
			expect(ledger(root, 'run', 'proof-sync', '--', 'node', '-e', `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(1)))`, 'a', 'b c', '--flag').status).toBe(0);
			expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(['a', 'b c', '--flag']);
		});

		it('records minutes, not seconds or ms: a 1.5 s command is about 0.025 min; rules out a wrong unit', () => {
			const root = repo();
			ledger(root, 'run', 'e2e-local', '--', 'node', '-e', 'setTimeout(() => {}, 1500)');
			const { minutes } = runs(root)[0]!.data;
			expect(minutes).toBeGreaterThanOrEqual(0.02);
			expect(minutes).toBeLessThan(0.2);
		});

		it('for mutation, records the score from reports/mutation/mutation.json (3 killed, 1 survived, 1 compile error: 75%); rules out omitting it or reading another file', () => {
			const root = repo();
			mkdirSync(path.join(root, 'reports/mutation'), { recursive: true });
			const mutants = ['Killed', 'Killed', 'Killed', 'Survived', 'CompileError'].map((status, id) => ({ id: String(id), mutatorName: 'BooleanLiteral', status, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } }));
			writeFileSync(path.join(root, 'reports/mutation/mutation.json'), JSON.stringify({ schemaVersion: '1', thresholds: { high: 80, low: 60 }, files: { 'src/lib/a.ts': { language: 'typescript', source: '', mutants } } }));
			expect(ledger(root, 'run', 'mutation', '--', 'node', '-e', '').status).toBe(0);
			const [record] = runs(root);
			expect(record!.data).toMatchObject({ by: 'mutation', result: 'pass' });
			expect(JSON.stringify({ ...record!.data, at: undefined, minutes: undefined })).toMatch(/\b75(\.0)?\b/);
		});

		it('records no score for a check other than mutation, even when a mutation report exists; rules out attaching it to every run', () => {
			const root = repo();
			mkdirSync(path.join(root, 'reports/mutation'), { recursive: true });
			writeFileSync(path.join(root, 'reports/mutation/mutation.json'), JSON.stringify({ files: { 'a.ts': { mutants: [{ status: 'Killed' }, { status: 'Survived' }, { status: 'Survived' }, { status: 'Survived' }] } } }));
			ledger(root, 'run', 'e2e-local', '--', 'node', '-e', '');
			expect(JSON.stringify({ ...runs(root)[0]!.data, at: undefined, minutes: undefined })).not.toMatch(/\b25(\.0)?\b/);
		});
	});

	describe('ledger agent <name> --tokens N ...', () => {
		it('records an agent run with numeric fields as numbers and the detail as given; rules out storing strings', () => {
			const root = repo();
			expect(ledger(root, 'agent', 'code-review', '--tokens', '74861', '--caught', '5', '--usd', '0.42', '--minutes', '1.72', '--pr', '35', '--detail', '3 important, 4 nits').status).toBe(0);
			const [only, ...more] = runs(root);
			expect(more).toEqual([]);
			expect(only!.data).toEqual({ at: expect.any(String), by: 'code-review', result: 'pass', tokens: 74_861, caught: 5, usd: 0.42, minutes: 1.72, pr: 35, detail: '3 important, 4 nits' });
			expect(path.basename(only!.file)).toBe(`${stampOf(only!.data.at)}-code-review.json`);
		});

		it('omits absent optional fields rather than writing null or undefined; rules out keys for flags not given', () => {
			const root = repo();
			ledger(root, 'agent', 'codex', '--tokens', '1200');
			const text = readFileSync(runs(root)[0]!.file, 'utf8');
			expect(JSON.parse(text)).toEqual({ at: expect.any(String), by: 'codex', result: 'pass', tokens: 1200 });
			expect(text).not.toContain('null');
		});
	});

	describe('ledger escape "<what>" --found-by X --should-have-caught Y', () => {
		it('writes verification/escapes/<timestamp>.json with the escape, introduced_in as a number; rules out writing it as a run record', () => {
			const root = repo();
			expect(ledger(root, 'escape', 'golden hour shown an hour late after DST', '--found-by', 'canary', '--should-have-caught', 'oracle', '--introduced-in', '35').status).toBe(0);
			const [only, ...more] = jsonIn<Escape>(path.join(root, 'verification/escapes'));
			expect(more).toEqual([]);
			expect(only!.data).toEqual({ at: expect.any(String), what: 'golden hour shown an hour late after DST', found_by: 'canary', should_have_caught: 'oracle', introduced_in: 35 });
			expect(path.basename(only!.file)).toBe(`${stampOf(only!.data.at)}.json`);
			expect(existsSync(path.join(root, 'verification/runs'))).toBe(false);
		});

		it('omits introduced_in when not given', () => {
			const root = repo();
			ledger(root, 'escape', 'stale tile', '--found-by', 'jason', '--should-have-caught', 'e2e');
			expect(jsonIn<Escape>(path.join(root, 'verification/escapes'))[0]!.data).toEqual({ at: expect.any(String), what: 'stale tile', found_by: 'jason', should_have_caught: 'e2e' });
		});
	});

	describe('ledger report (stand-in gh serving real PR #37 and #24 check runs)', () => {
		const ghLog = path.join(scratch, 'gh-args.log');
		const ghData = path.join(scratch, 'gh-data.json');
		// why: the real PR commit order and check runs, served the way gh -q would shape them, so the report runs without the network
		writeFileSync(ghData, JSON.stringify({ prs: ['37', '24'], commits: Object.fromEntries(['37', '24'].map((pr) => [pr, [...new Set(captured[pr]!.map(({ commit }) => commit))]])), runs: [...captured['37']!, ...captured['24']!] }));
		writeFileSync(
			path.join(bin, 'gh'),
			`#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(ghLog)}, JSON.stringify(args) + '\\n');
const data = JSON.parse(fs.readFileSync(${JSON.stringify(ghData)}, 'utf8'));
const api = args[0] === 'api' ? args[1] : '';
if (args[0] === 'pr' && args[1] === 'list') process.stdout.write(data.prs.join('\\n') + '\\n');
else if (/pulls\\/(\\d+)\\/commits/.test(api)) process.stdout.write(data.commits[/pulls\\/(\\d+)\\/commits/.exec(api)[1]].join('\\n') + '\\n');
else if (/commits\\/([0-9a-f]+)\\/check-runs/.test(api)) {
	const sha = /commits\\/([0-9a-f]+)\\/check-runs/.exec(api)[1];
	process.stdout.write(JSON.stringify(data.runs.filter((run) => run.commit === sha).map(({ name, conclusion, started_at, completed_at }) => ({ name, conclusion, started_at, completed_at }))));
} else { console.error('unexpected gh ' + args.join(' ')); process.exit(1); }
`
		);
		chmodSync(path.join(bin, 'gh'), 0o755);

		const table = (stdout: string) => {
			const lines = stdout.split('\n').filter((line) => line.includes('|'));
			const header = lines[0]!.split('|').map((cell) => cell.trim());
			return lines.slice(1).map((line) => Object.fromEntries(line.split('|').map((cell, i) => [header[i], cell.trim()])) as Record<string, string>);
		};
		const root = repo();
		mkdirSync(path.join(root, 'verification/runs'), { recursive: true });
		for (const { file } of migrated) writeFileSync(path.join(root, 'verification/runs', file), readFileSync(new URL(file, migratedDir)));
		mkdirSync(path.join(root, 'verification/escapes'), { recursive: true });
		writeFileSync(path.join(root, 'verification/escapes/2026-11-23T10-00-00-000Z.json'), JSON.stringify({ at: '2026-11-23T10:00:00.000Z', what: 'late sunset', found_by: 'canary', should_have_caught: 'e2e' }));

		it('reports per check CI catches and runs merged with the real records and escapes, ordered by catches; rules out a report that ignores records, CI or escapes', () => {
			rmSync(ghLog, { force: true });
			const result = ledger(root);
			expect(result.status, result.stderr).toBe(0);
			const rows = table(result.stdout);
			expect(rows.slice(0, 4).map((row) => row.check)).toEqual(['code-review', 'oracle', 'checks', 'evidence']);
			const row = (check: string) => rows.find((r) => r.check === check)!;
			expect(row('code-review')).toMatchObject({ catches: '5', runs: '2', tokens: '140215', escapes: '0' });
			expect(row('oracle')).toMatchObject({ catches: '2', runs: '4', tokens: '7106479', escapes: '0' });
			expect(Number(row('oracle').usd)).toBeCloseTo(5.65, 2);
			expect(row('checks')).toMatchObject({ catches: '1', runs: '7' });
			expect(row('evidence')).toMatchObject({ catches: '1', runs: '3' });
			expect(row('e2e')).toMatchObject({ catches: '0', runs: '3', escapes: '1' });
			expect(readFileSync(ghLog, 'utf8')).toContain('"pr","list"');
		});

		it('passes --prs N to gh as the merged-PR limit; rules out ignoring the flag', () => {
			rmSync(ghLog, { force: true });
			expect(ledger(root, '--prs', '7').status).toBe(0);
			const list = readFileSync(ghLog, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as string[]).find((args) => args[0] === 'pr')!;
			expect(list).toContain('merged');
			expect(list[list.indexOf('--limit') + 1]).toBe('7');
		});
	});
});
