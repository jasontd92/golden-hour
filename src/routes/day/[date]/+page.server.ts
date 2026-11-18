import { error } from '@sveltejs/kit';
import { loadPlan } from '#lib/server/plan.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => loadPlan().map(({ date }) => ({ date }));

export const load: PageServerLoad = ({ params }) => {
	const session = loadPlan().find((s) => s.date === params.date);
	if (!session) error(404, 'No session on that day');
	return { session };
};
