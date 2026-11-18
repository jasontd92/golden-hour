import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LiftsFile, Result, Workout, WorkoutsFile } from './history.ts';

const read = (file: string) => readFileSync(new URL(`../../../data/normalized/${file}`, import.meta.url), 'utf8');
const workouts: unknown[] = JSON.parse(read('workouts.json'));
const resultLines = read('results.jsonl').split('\n').filter(Boolean);
const lifts: unknown = JSON.parse(read('lifts.json'));

describe('normalized data parses without loss', () => {
	it('every workouts.json entry', () => {
		expect(workouts).toHaveLength(259);
		for (const workout of workouts) expect(Workout.parse(workout)).toStrictEqual(workout);
		expect(WorkoutsFile.parse(workouts)).toStrictEqual(workouts);
	});

	it('every results.jsonl line', () => {
		expect(resultLines).toHaveLength(366);
		for (const line of resultLines) {
			const record: unknown = JSON.parse(line);
			expect(Result.parse(record), line).toStrictEqual(record);
		}
	});

	it('every lifts.json entry', () => {
		expect(LiftsFile.parse(lifts)).toStrictEqual(lifts);
		expect(Object.values(LiftsFile.parse(lifts)).flat()).toHaveLength(89);
	});
});

describe('the schemas reject drift', () => {
	const fran = { workout: 'fran', date: '2023-04-03', date_precision: 'day', source: 'test' };

	it('unknown keys', () => {
		expect(Result.safeParse({ ...fran, scroe: '3:10' }).success).toBe(false);
		expect(Workout.safeParse({ ...(workouts[0] as object), extra: true }).success).toBe(false);
	});

	it('a date that contradicts its precision', () => {
		expect(Result.safeParse(fran).success).toBe(true);
		expect(Result.safeParse({ ...fran, date_precision: 'month' }).success).toBe(false);
		expect(Result.safeParse({ ...fran, date: '2023-04', date_precision: 'month' }).success).toBe(true);
		expect(Result.safeParse({ ...fran, date_precision: 'unknown' }).success).toBe(false);
	});

	it('an unknown-precision date without date_text', () => {
		const undated = { workout: 'fran', source: 'test' };
		expect(Result.safeParse({ ...undated, date_precision: 'unknown' }).success).toBe(false);
		expect(Result.safeParse({ ...undated, date_precision: 'unknown', date_text: '11/9' }).success).toBe(true);
	});

	it('a movement tag outside the vocabulary', () => {
		const workout = workouts[0] as Workout;
		const tags = { ...workout.tags, movements: ['moonwalk'] };
		expect(Workout.safeParse({ ...workout, tags }).success).toBe(false);
	});
});
