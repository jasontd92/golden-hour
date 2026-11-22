import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

const optional = z.string().min(1).optional();

export const variables = defineEnvVars({
	SYNC_TOKEN: { schema: optional, description: 'Shared secret the phone sends as a bearer token to /api/sync.' },
	TURSO_DATABASE_URL: { schema: optional, description: 'libSQL URL of the log database.' },
	TURSO_AUTH_TOKEN: { schema: optional, description: 'Turso auth token for TURSO_DATABASE_URL.' },
	VERCEL_GIT_COMMIT_SHA: {
		schema: (value) => (value && /^[0-9a-f]{40}$/.test(value) ? value : undefined),
		description: 'Commit Vercel built this deployment from; /api/sync reports it so the canary can tell which build it probed.'
	}
});
