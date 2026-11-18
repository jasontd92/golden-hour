import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LiftsFile, Result, WorkoutsFile, type Workout } from './history.ts';
import {
	benchmarkRows,
	bestOneRepMax,
	bestResult,
	dateLabel,
	liftHistory,
	isMainLift,
	latestLiftDate,
	liftRows,
	mainLiftRows,
	resultHistory,
	sourceLabel,
	topBenchmarkRows
} from './progress.ts';
import { testBattery } from './battery.ts';

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

	it('lists favorites, then the battery in plan order, then other tests and recurring girls', () => {
		expect(ids.slice(0, 3)).toEqual(['turkey-trot-triple', 'jason-cunningham', 'crossfit-total']);
		const battery = testBattery.filter((id) => id !== 'jason-cunningham');
		expect(ids.slice(2, 2 + battery.length)).toEqual(battery);
		const rest = rows.slice(2 + battery.length).map((r) => workout(r.id).kind);
		expect(rest).toEqual([...rest].sort((a, b) => order(a) - order(b)));
		expect(new Set(rest)).toEqual(new Set(['test', 'girl']));
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

const order = (kind: string) => ['test', 'girl'].indexOf(kind);

describe('topBenchmarkRows', () => {
	const top = topBenchmarkRows(workouts, results).map((r) => r.id);

	it('every battery test is a scored workout in the catalog', () => {
		const scored = new Set(benchmarkRows(workouts, results).map((r) => r.id));
		expect(testBattery.filter((id) => !scored.has(id))).toEqual([]);
	});

	it('is the favorites plus the test battery, in the full list order', () => {
		const all = benchmarkRows(workouts, results).map((r) => r.id);
		expect(top).toEqual(all.slice(0, top.length));
		expect(new Set(top)).toEqual(new Set(['turkey-trot-triple', ...testBattery]));
	});

	it('leaves tests outside the revised battery for the full list', () => {
		for (const id of ['king-kong-womens-rx', 'ski-2000m', 'run-5k', 'helen']) expect(top).not.toContain(id);
		expect(benchmarkRows(workouts, results).map((r) => r.id)).toContain('king-kong-womens-rx');
	});
});

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

	it('lists every piece of evidence, newest first', () => {
		const history = liftHistory(lifts['back-squat'] ?? []);
		expect(history).toHaveLength(12);
		expect(history[0]).toEqual({ date: 'Nov 16, 2026', score: '255 × 1', source: 'Sheet' });
		expect(history[1]).toEqual({ date: 'Nov 6, 2024', score: '235', source: 'SugarWOD' });
		expect(history.at(-1)?.date).toBe('Undated');
		expect(history.map((h) => h.score)).toContain('275 × 3');
	});

	it('the 2026-11-16 CrossFit Total adds 1RM evidence without changing the bests', () => {
		const cft = (id: string) => (lifts[id] ?? []).filter((e) => e.date === '2026-11-16');
		expect(['back-squat', 'shoulder-press', 'deadlift'].map((id) => cft(id).map((e) => [e.load, e.reps, e.source]))).toEqual([
			[[255, 1, 'google-sheet/tests']],
			[[160, 1, 'google-sheet/tests']],
			[[335, 1, 'google-sheet/tests']]
		]);
		expect(['back-squat', 'shoulder-press', 'deadlift'].map((id) => bestOneRepMax(lifts[id] ?? []))).toEqual([
			295, 165, 365
		]);
	});
});

describe('mainLiftRows', () => {
	const today = '2026-11-18';

	it('shows the four main lifts on the normalized data', () => {
		expect(mainLiftRows(lifts).map((r) => [r.name, r.best])).toEqual([
			['Deadlift', '365'],
			['Back squat', '295'],
			['Bench press', '275'],
			['Shoulder press', '165']
		]);
	});

	it('adds any other lift with dated 1RM evidence in the last 3 years', () => {
		const at = (date: string | null, reps: number | null = 1) => [{ date, load: 200, reps, source: 'x' }];
		expect(isMainLift('thruster', at('2023-11-18'), today)).toBe(true);
		expect(isMainLift('thruster', at('2023-11-17'), today)).toBe(false);
		expect(isMainLift('thruster', at(null), today)).toBe(false);
		expect(isMainLift('thruster', at('2026-01-01', 3), today)).toBe(false);
		expect(isMainLift('bench-press', [], today)).toBe(true);
	});

	it('measures the window from the newest dated lift in the data, so a rebuild years later lists the same lifts', () => {
		expect(latestLiftDate(lifts)).toBe('2026-11-16');
		const withThruster = { ...lifts, thruster: [{ date: '2023-11-16', load: 135, reps: 1, source: 'x' }] };
		expect(mainLiftRows(withThruster).map((r) => r.id)).toContain('thruster');
		const older = { ...lifts, thruster: [{ date: '2023-11-15', load: 135, reps: 1, source: 'x' }] };
		expect(mainLiftRows(older).map((r) => r.id)).not.toContain('thruster');
		expect(mainLiftRows({ 'bench-press': [{ date: null, load: 275, reps: 1, source: 'x' }] }).map((r) => r.id)).toEqual(['bench-press']);
	});

	it('keeps every lift for the full list', () => {
		expect(liftRows(lifts)).toHaveLength(11);
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
