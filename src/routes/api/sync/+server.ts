import { handleSync, syncHealth } from '#lib/server/sync.ts';
import { syncDeps } from '#lib/server/sync-env.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request }) => handleSync(request, syncDeps());

export const GET: RequestHandler = () => syncHealth(syncDeps());
