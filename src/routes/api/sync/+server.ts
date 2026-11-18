import { SYNC_TOKEN } from '$app/env/private';
import { failureReason } from '#lib/server/failure.ts';
import type { RequestHandler } from './$types';

const server = () => import('#lib/server/sync-env.ts');

const unavailable = (error: unknown, body: object) => {
	const reason = failureReason(error);
	console.error(`sync: request failed (${reason})`);
	return Response.json({ ...body, reason }, { status: 503 });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		return await (await server()).sync(request);
	} catch (error) {
		return unavailable(error, { error: 'Sync failed on the server; nothing was confirmed.' });
	}
};

export const GET: RequestHandler = async () => {
	try {
		return await (await server()).health();
	} catch (error) {
		return unavailable(error, { token: Boolean(SYNC_TOKEN), database: 'error' });
	}
};
