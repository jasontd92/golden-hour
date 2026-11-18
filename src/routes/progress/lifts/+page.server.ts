import { liftRows } from '#lib/domain/progress.ts';
import { lifts } from '#lib/server/history-data.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => ({ rows: liftRows(lifts) });
