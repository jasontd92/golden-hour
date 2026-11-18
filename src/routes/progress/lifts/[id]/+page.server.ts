import { error } from '@sveltejs/kit';
import { liftHistory, liftName, liftRows } from '#lib/domain/progress.ts';
import { lifts } from '#lib/server/history-data.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => liftRows(lifts).map(({ id }) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
	const evidence = lifts[params.id];
	if (!evidence) error(404, 'No such lift');
	return { name: liftName(params.id), rows: liftHistory(evidence) };
};
