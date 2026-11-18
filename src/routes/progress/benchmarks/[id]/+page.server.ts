import { error } from '@sveltejs/kit';
import { benchmarkWorkouts, resultHistory } from '#lib/domain/progress.ts';
import { results, workouts } from '#lib/server/history-data.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => benchmarkWorkouts(workouts, results).map(({ id }) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
	const workout = workouts.find((w) => w.id === params.id);
	if (!workout) error(404, 'No such benchmark');
	return { name: workout.name, rows: resultHistory(workout, results) };
};
