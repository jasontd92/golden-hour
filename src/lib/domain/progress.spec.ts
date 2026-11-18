import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LiftsFile, Result, WorkoutsFile, type Workout } from './history.ts';
import {
	benchmarkRows,
	bestOneRepMax,
	bestResult,
	dateLabel,
	liftHistory,
	liftRows,
	resultHistory,
	sourceLabel
} from './progress.ts';

const read = (file: string) => readFileSync(new URL(`../../../data/normalized/${file}`, import.meta.url), 'utf8');
const workouts = WorkoutsFile.parse(JSON.parse(read('workouts.json')));
const lifts = LiftsFile.parse(JSON.parse(read('lifts.json')));
const results = read('results.jsonl')
	.split('\n')
	.filter(Boolean)
	.map((line) => Result.parse(JSON.parse(line)));
const workout = (id: string): Workout => {
	const found = workouts.find((w) => w.id === id);
	if (!found) throw new Error(`no workout ${id}`);
	return found;
};

const time: Workout = { ...workout('fran'), id: 'probe' };
const probe = (value: number, extra: Partial<Result> = {}): Result => ({
	workout: 'probe',
	date: '2024-01-01',
	date_precision: 'day',
	value,
	source: 'probe',
	...extra
});

describe('bestResult on the normalized data', () => {
	it('best Fran is 4:43', () => {
		const { result, conflicted } = bestResult(workout('fran'), results);
		expect([result?.score_display, conflicted]).toEqual(['4:43', false]);
	});

	it('best CrossFit Total skips the conflicted 845 and flags that a conflicted result ties it', () => {
		const { result, conflicted } = bestResult(workout('crossfit-total'), results);
		expect(result?.conflict).toBeUndefined();
		expect([result?.score_display, result?.date, result?.source, conflicted]).toEqual([
			'845',
			'2023-10-30',
			'sugarwod#row266',
			true
		]);
	});

	it('the 2026-11 CrossFit Total is in the history but is not the best', () => {
		const history = resultHistory(workout('crossfit-total'), results);
		expect(history[0]).toEqual({ date: 'Nov 16, 2026', score: '750', source: 'Sheet' });
		expect(history.filter((row) => row.conflict !== undefined)).toHaveLength(1);
	});
});

describe('bestResult conflict handling', () => {
	it('never picks a conflicted result, even when it is the fastest', () => {
		const best = bestResult(time, [probe(300), probe(200, { conflict: 'sources disagree' })]);
		expect([best.result?.value, best.conflicted]).toEqual([300, true]);
	});

	it('does not flag a conflicted result that is worse than the best', () => {
		const best = bestResult(time, [probe(200), probe(300, { conflict: 'sources disagree' })]);
		expect([best.result?.value, best.conflicted]).toEqual([200, false]);
	});

	it('has no best when every scored result is conflicted', () => {
		const best = bestResult(time, [probe(200, { conflict: 'x' })]);
		expect([best.result, best.conflicted]).toEqual([undefined, true]);
	});

	it('keeps the earliest of tied results', () => {
		const best = bestResult(time, [probe(200, { date: '2024-05-01' }), probe(200, { date: '2023-01-01' })]);
		expect(best.result?.date).toBe('2023-01-01');
	});

	it('uses higher-is-better for loads', () => {
		const total = workout('crossfit-total');
		const best = bestResult({ ...total, id: 'probe' }, [probe(700), probe(800)]);
		expect(best.result?.value).toBe(800);
	});
});

describe('benchmarkRows', () => {
	const rows = benchmarkRows(workouts, results);
	const ids = rows.map((r) => r.id);

	it('lists favorites first, then the test battery, then recurring girls', () => {
		expect(ids.slice(0, 3)).toEqual(['turkey-trot-triple', 'jason-cunningham', 'crossfit-total']);
		const kinds = rows.map((r) => workout(r.id)).map((w) => (w.favorite ? 'favorite' : w.kind));
		expect(kinds).toEqual([...kinds].sort((a, b) => order(a) - order(b)));
		expect(new Set(kinds)).toEqual(new Set(['favorite', 'test', 'girl']));
	});

	it('leaves out lost or reconstructed definitions and unscorable tests', () => {
		expect(ids).not.toContain('kong-is-king');
		expect(ids).not.toContain('launchpad');
		expect(ids).not.toContain('max-vertical-jump');
	});

	it('shows the expected bests', () => {
		const best = Object.fromEntries(rows.map((r) => [r.id, r.best]));
		expect(best).toMatchObject({ fran: '4:43', 'crossfit-total': '845', 'turkey-trot-triple': '46:18' });
		expect(rows.find((r) => r.id === 'crossfit-total')?.conflicted).toBe(true);
	});
});

const order = (kind: string) => ['favorite', 'test', 'girl'].indexOf(kind);

describe('lifts', () => {
	it('best back squat 1RM is 295', () => {
		expect(bestOneRepMax(lifts['back-squat'] ?? [])).toBe(295);
		expect(liftRows(lifts).find((r) => r.id === 'back-squat')?.best).toBe('295');
	});

	it('counts only 1-rep evidence', () => {
		expect(bestOneRepMax([{ date: null, load: 400, reps: 3, source: 'x' }])).toBeUndefined();
		expect(liftRows(lifts).map((r) => r.id)).not.toContain('push-press');
	});

	it('orders lifts by best load and names them from the slug', () => {
		const rows = liftRows(lifts);
		expect(rows.slice(0, 2).map((r) => [r.name, r.best])).toEqual([
			['Deadlift', '365'],
			['Back squat', '295']
		]);
	});

	it('lists every piece of evidence, dated first', () => {
		const history = liftHistory(lifts['back-squat'] ?? []);
		expect(history).toHaveLength(11);
		expect(history[0]).toEqual({ date: 'Nov 6, 2024', score: '235', source: 'SugarWOD' });
		expect(history.at(-1)?.date).toBe('Undated');
		expect(history.map((h) => h.score)).toContain('275 × 3');
	});
});

describe('dates and sources', () => {
	it.each([
		[{ date: '2023-05-11', date_precision: 'day' as const }, 'May 11, 2023'],
		[{ date: '2025-08', date_precision: 'month' as const }, 'Aug 2025'],
		[{ date: '2023-08-07', date_precision: 'approx' as const }, '~Aug 7, 2023'],
		[{ date_precision: 'unknown' as const, date_text: '11/9 (year unknown)' }, '11/9 (year unknown)']
	])('%o → %s', (result, label) => expect(dateLabel(result)).toBe(label));

	it('renders every unknown-precision result as its date_text', () => {
		const unknown = results.filter((r) => r.date_precision === 'unknown');
		expect(unknown.length).toBeGreaterThan(0);
		const history = resultHistory(workout('benchmark-anaerobic'), results);
		for (const r of unknown) expect(history.map((h) => h.date)).toContain(r.date_text);
	});

	it.each([
		['sugarwod#row12', 'SugarWOD'],
		['sugarwod-snapshot-2026-11-17', 'SugarWOD profile'],
		['google-sheet/tests+evo1', 'Sheet'],
		['apple-notes/fran', 'Notes'],
		['somewhere-new', 'somewhere-new']
	])('%s → %s', (source, label) => expect(sourceLabel(source)).toBe(label));
});
