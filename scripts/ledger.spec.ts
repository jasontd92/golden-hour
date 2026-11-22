import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Entry, type Run, programmaticCatches, programmaticCosts, summarize } from './ledger.ts';

// why: real check runs from jasontd92/golden-hour, in PR commit order, as gh api commits/<sha>/check-runs returned them
const captured = JSON.parse(readFileSync(new URL('./fixtures/oracle/check-runs.json', import.meta.url), 'utf8')) as Record<string, { commit: string; name: string; conclusion: string | null; started_at: string; completed_at: string | null }[]>;
const runsOf = (pr: string): Run[] =>
	captured[pr]!.filter((run) => run.completed_at).map(({ commit, name, conclusion, started_at, completed_at }) => ({ commit, name, conclusion: conclusion!, minutes: (Date.parse(completed_at!) - Date.parse(started_at)) / 60_000 }));
const byName = <T extends { by: string }>(list: T[]) => [...list].sort((a, b) => a.by.localeCompare(b.by));
const run = (commit: string, name: string, conclusion: string, minutes = 1): Run => ({ commit, name, conclusion, minutes });

describe('programmaticCatches', () => {
	const keys = (catches: { by: string; commit?: string }[]) => catches.map(({ by, commit }) => `${by}@${commit}`).sort();

	it('gives real PR #37 one catch for its one streak: checks failed 8b1b6ff..e32ecae and passed at 172d15f, so checks@8b1b6ff; rules out one catch per failing commit (4), or crediting the last failing or the passing commit', () => {
		const catches = programmaticCatches(runsOf('37'));
		expect(catches).toHaveLength(1);
		expect(catches[0]).toMatchObject({ by: 'checks', kind: 'programmatic', real: null, commit: '8b1b6ff1622e261b6a1c97141a93da0ca11d72a2' });
	});

	it('still finds the one real catch in PR #24: evidence failed at 95ca93e and passed at a032f6d', () => {
		const catches = programmaticCatches(runsOf('24'));
		expect(catches).toHaveLength(1);
		expect(catches[0]).toMatchObject({ by: 'evidence', kind: 'programmatic', real: null, commit: '95ca93e0bc999f7ce3e9b90f2d6398f644c8878a' });
	});

	it('finds none in PRs #27 and #33, which never failed, nor in #35, whose only commit failed with no later pass; rules out counting a streak still failing at the last commit', () => {
		for (const pr of ['27', '33', '35']) expect(programmaticCatches(runsOf(pr))).toEqual([]);
	});

	it('credits the first failing commit of a streak; rules out the last failing commit or the passing commit', () => {
		expect(keys(programmaticCatches([run('c1', 'unit', 'failure'), run('c2', 'unit', 'failure'), run('c3', 'unit', 'failure'), run('c4', 'unit', 'success')]))).toEqual(['unit@c1']);
	});

	it('gives one catch per streak: fail, pass, fail, pass is two catches at c1 and c3; rules out one catch per check', () => {
		const catches = programmaticCatches([run('c1', 'unit', 'failure'), run('c2', 'unit', 'success'), run('c3', 'unit', 'failure'), run('c4', 'unit', 'success')]);
		expect(keys(catches)).toEqual(['unit@c1', 'unit@c3']);
		for (const c of catches) expect(c).toMatchObject({ kind: 'programmatic', real: null });
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
	const entries: Entry[] = [
		{
			pr: 24,
			title: 'fix ff',
			catches: [
				{ by: 'evidence', kind: 'programmatic', what: 'failed at 95ca93e', real: true, commit: '95ca93e' },
				{ by: 'oracle', kind: 'agent', what: 'missed merge exemption', real: true },
				{ by: 'oracle', kind: 'agent', what: 'false alarm', real: false }
			],
			costs: [
				{ by: 'evidence', runs: 2, minutes: 2 },
				{ by: 'oracle', runs: 1, tokens: 50_000 }
			]
		},
		{
			pr: 27,
			title: 'canary budgets',
			catches: [
				{ by: 'checks', kind: 'programmatic', what: 'failed at c02c217', real: null, commit: 'c02c217' },
				{ by: 'oracle', kind: 'agent', what: 'weak assertion', real: true },
				{ by: 'e2e', kind: 'programmatic', what: 'flaky', real: false }
			],
			costs: [
				{ by: 'checks', runs: 4, minutes: 8 },
				{ by: 'evidence', runs: 2, minutes: 2 },
				{ by: 'e2e', runs: 2, minutes: 7 },
				{ by: 'bundle-budget', runs: 4, minutes: 4 },
				{ by: 'oracle', runs: 2, tokens: 120_000 }
			]
		}
	];

	it('tallies real/flake/unclassified and sums runs, minutes and tokens per check across PRs; rules out last-entry-wins or dropping cost-only checks', () => {
		expect(byName(summarize(entries))).toEqual(
			byName([
				{ by: 'oracle', real: 2, flake: 1, unclassified: 0, runs: 3, minutes: 0, tokens: 170_000 },
				{ by: 'evidence', real: 1, flake: 0, unclassified: 0, runs: 4, minutes: 4, tokens: 0 },
				{ by: 'checks', real: 0, flake: 0, unclassified: 1, runs: 4, minutes: 8, tokens: 0 },
				{ by: 'e2e', real: 0, flake: 1, unclassified: 0, runs: 2, minutes: 7, tokens: 0 },
				{ by: 'bundle-budget', real: 0, flake: 0, unclassified: 0, runs: 4, minutes: 4, tokens: 0 }
			])
		);
	});

	it('orders by real catches, most first; rules out ordering by name, runs or cost', () => {
		const reals = summarize(entries).map(({ real }) => real);
		expect(reals).toEqual([...reals].sort((a, b) => b - a));
		expect(summarize(entries).slice(0, 2).map(({ by }) => by)).toEqual(['oracle', 'evidence']);
	});

	it('returns nothing for an empty ledger', () => {
		expect(summarize([])).toEqual([]);
	});
});
