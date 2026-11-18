import { localIsoDate } from '#lib/domain/calendar.ts';
import { benchmarkRows, liftRows, mainLiftRows, topBenchmarkRows } from '#lib/domain/progress.ts';
import { lifts, results, workouts } from '#lib/server/history-data.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => ({
	benchmarks: topBenchmarkRows(workouts, results),
	lifts: mainLiftRows(lifts, localIsoDate(Date.now())),
	benchmarkCount: benchmarkRows(workouts, results).length,
	liftCount: liftRows(lifts).length
});
