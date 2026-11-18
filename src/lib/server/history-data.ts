import { z } from 'zod';
import { LiftsFile, Result, WorkoutsFile } from '#lib/domain/history.ts';
import liftsText from '../../../data/normalized/lifts.json?raw';
import resultsText from '../../../data/normalized/results.jsonl?raw';
import workoutsText from '../../../data/normalized/workouts.json?raw';

export const workouts = WorkoutsFile.parse(JSON.parse(workoutsText));
export const lifts = LiftsFile.parse(JSON.parse(liftsText));
export const results = z.array(Result).parse(
	resultsText
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line): unknown => JSON.parse(line))
);
