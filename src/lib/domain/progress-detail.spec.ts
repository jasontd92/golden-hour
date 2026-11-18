import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LiftsFile, Result, WorkoutsFile } from './history.ts';
import { benchmarkDetail, liftDetail } from './progress-detail.ts';

const workouts = WorkoutsFile.parse(JSON.parse(readFileSync('data/normalized/workouts.json', 'utf8')));
const lifts = LiftsFile.parse(JSON.parse(readFileSync('data/normalized/lifts.json', 'utf8')));
const results = readFileSync('data/normalized/results.jsonl', 'utf8')
	.split('\n')
	.filter((line) => line.trim() !== '')
	.map((line) => Result.parse(JSON.parse(line)));
const workout = (id: string) => {
	const found = workouts.find((w) => w.id === id);
	if (!found) throw new Error(id);
	return found;
};
const firstMonday = '2026-12-07';

describe('benchmarkDetail', () => {
	it('gives Fran its best, latest and dated history, with no target', () => {
		const fran = benchmarkDetail(workout('fran'), results, firstMonday);
		expect(fran).toMatchObject({ name: 'Fran', unit: 'time', better: 'lower', best: '4:43', latest: '6:34', target: undefined });
		expect(fran.observations.map((o) => o.date)).toEqual(['2023-05-11', '2025-08-15']);
		expect(fran.history).toHaveLength(2);
	});

	it('sets the CrossFit Total target from the latest total before the plan', () => {
		const cft = benchmarkDetail(workout('crossfit-total'), results, firstMonday);
		expect(cft).toMatchObject({ best: '845', latest: '750', target: '800' });
	});
});

describe('liftDetail', () => {
	it('uses dated one-rep maxes for latest and the target', () => {
		const squat = liftDetail('back-squat', lifts['back-squat'] ?? [], firstMonday);
		expect(squat).toMatchObject({ name: 'Back squat', unit: 'pounds', best: '295', latest: '255', target: '275' });
		expect(squat.targets).toEqual([{ week: 16, value: 275 }]);
	});
});
