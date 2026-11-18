import { benchmarkRows } from '#lib/domain/progress.ts';
import { results, workouts } from '#lib/server/history-data.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => ({ rows: benchmarkRows(workouts, results) });
