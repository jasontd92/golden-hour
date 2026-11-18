import { benchmarkRows, liftRows } from '#lib/domain/progress.ts';
import { lifts, results, workouts } from '#lib/server/history-data.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => ({
	benchmarks: benchmarkRows(workouts, results),
	lifts: liftRows(lifts)
});
