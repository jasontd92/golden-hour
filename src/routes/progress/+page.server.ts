import { localIsoDate, mondayOf } from '#lib/domain/calendar.ts';
import { benchmarkDetail, liftDetail } from '#lib/domain/progress-detail.ts';
import { benchmarkRows, liftRows, mainLiftRows, topBenchmarkRows } from '#lib/domain/progress.ts';
import { lifts, results, workouts } from '#lib/server/history-data.ts';
import { loadPlan } from '#lib/server/plan.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const benchmarks = topBenchmarkRows(workouts, results);
	const mainLifts = mainLiftRows(lifts, localIsoDate(Date.now()));
	const firstMonday = mondayOf(loadPlan()[0]?.date ?? localIsoDate(Date.now()));
	return {
		benchmarks,
		lifts: mainLifts,
		benchmarkCount: benchmarkRows(workouts, results).length,
		liftCount: liftRows(lifts).length,
		firstMonday,
		details: [
			...benchmarks.flatMap((row) => {
				const workout = workouts.find((w) => w.id === row.id);
				return workout ? [benchmarkDetail(workout, results, firstMonday)] : [];
			}),
			...mainLifts.map((row) => liftDetail(row.id, lifts[row.id] ?? [], firstMonday))
		]
	};
};
