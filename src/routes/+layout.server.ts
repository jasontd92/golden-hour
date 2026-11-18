import { loadPlan } from '#lib/server/plan.ts';
import type { LayoutServerLoad } from './$types';

export const prerender = true;

export const load: LayoutServerLoad = () => ({ plan: loadPlan() });
