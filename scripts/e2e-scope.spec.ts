import { expect, it } from 'vitest';
import { changesRendering } from './e2e-scope.ts';

it('skips e2e when nothing rendered changed', () => {
	expect(changesRendering(['scripts/canary.ts', '.github/workflows/ci.yml', 'src/routes/api/sync/+server.ts', 'src/lib/server/sync.ts', 'src/env.ts', 'src/lib/domain/plan.spec.ts'])).toBe(false);
});

it('runs e2e when a page, feature, shared UI, data, plan or e2e file changed', () => {
	for (const file of ['src/routes/+page.svelte', 'src/lib/features/log/steps.ts', 'src/lib/ui/tokens.css', 'data/curated/results.json', 'plan/week-01.json', 'e2e/test.ts', 'playwright.config.ts']) {
		expect(changesRendering([file]), file).toBe(true);
	}
});
