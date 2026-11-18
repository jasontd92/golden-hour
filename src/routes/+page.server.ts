import { featureFlag } from '#lib/server/flags.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ startEnabled: featureFlag('today', 'start') });
