import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Result, Workout, type ScoreType } from './history.ts';
import { formatScore, parseClock, parseScore } from './score.ts';

const read = (file: string) => readFileSync(new URL(`../../../data/normalized/${file}`, import.meta.url), 'utf8');
const scoreType = new Map(
	(JSON.parse(read('workouts.json')) as unknown[]).map((w) => Workout.parse(w)).map((w) => [w.id, w.score.type])
);
const results = read('results.jsonl')
	.split('\n')
	.filter(Boolean)
	.map((line) => Result.parse(JSON.parse(line)));
const typeOf = (workout: string): ScoreType => scoreType.get(workout) ?? 'text';

describe('parseClock', () => {
	it.each([
		['7:10', 430],
		['1:04.95', 64.95],
		['53:13:00', 3193],
		['1:02:03', 3723],
		[' 3:05 ', 185],
		['3:5', undefined],
		['DNF', undefined]
	])('%s → %s', (text, seconds) => expect(parseClock(text)).toBe(seconds));
});

describe('parseScore', () => {
	it.each<[string | number, ScoreType, ReturnType<typeof parseScore>]>([
		['46:18', 'time', { value: 2778, unit: 's' }],
		['4+32', 'rounds_reps', { value: 4.032, unit: 'rounds.reps' }],
		['5 + 2', 'rounds_reps', { value: 5.002, unit: 'rounds.reps' }],
		['8', 'rounds_reps', { value: 8, unit: 'rounds' }],
		['11 r + 5', 'rounds_reps', undefined],
		['255', 'load_lb', { value: 255, unit: 'lb' }],
		[750, 'load_lb', { value: 750, unit: 'lb' }],
		['13', 'reps', { value: 13, unit: 'reps' }],
		['29', 'seconds', { value: 29, unit: 's' }],
		['10.25', 'points', { value: 10.25, unit: 'pts' }],
		['109', 'text', { value: 109 }],
		['-3', 'checkbox', { value: -3 }],
		['Yes', 'checkbox', undefined],
		['7:48', 'reps', undefined]
	])('%s as %s', (score, type, parsed) => expect(parseScore(score, type)).toStrictEqual(parsed));

	it('reproduces every curated result value in results.jsonl', () => {
		const curated = results.filter((r) => !r.source.startsWith('sugarwod#') && r.score_display !== undefined);
		expect(curated.length).toBeGreaterThan(70);
		for (const r of curated) {
			const expected = r.value === undefined ? undefined : r.unit ? { value: r.value, unit: r.unit } : { value: r.value };
			expect(parseScore(r.score_display ?? '', typeOf(r.workout)), r.source).toStrictEqual(expected);
		}
	});
});

describe('formatScore is the inverse of parseScore', () => {
	it.each<[number, ScoreType, string]>([
		[2778, 'time', '46:18'],
		[64.95, 'time', '1:04.95'],
		[35.5, 'time', '0:35.5'],
		[3723, 'time', '62:03'],
		[4.032, 'rounds_reps', '4+32'],
		[5.002, 'rounds_reps', '5+2'],
		[8, 'rounds_reps', '8'],
		[255, 'load_lb', '255'],
		[29, 'seconds', '29']
	])('%s as %s → %s', (value, type, text) => expect(formatScore(value, type)).toBe(text));

	it('round-trips every parsed value in results.jsonl', () => {
		const scored = results.filter((r) => r.value !== undefined && r.unit !== undefined);
		expect(scored.length).toBeGreaterThan(300);
		for (const r of scored) {
			const type = typeOf(r.workout);
			const value = r.value ?? 0;
			expect(parseScore(formatScore(value, type), type)?.value, r.source).toBe(value);
		}
	});
});
