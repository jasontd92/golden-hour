import { expect, it } from 'vitest';
import { e2eScope } from './e2e-scope.ts';

const features = [
	{ name: 'today', route: '/', e2e: 'e2e/today.e2e.ts' },
	{ name: 'lift-history', route: '/progress/lifts/[id]', e2e: 'e2e/progress.e2e.ts' }
];
const specs = ['e2e/plan.desktop.e2e.ts', 'e2e/progress.e2e.ts', 'e2e/pwa.e2e.ts', 'e2e/today.e2e.ts'];
const scope = (...changed: string[]) => e2eScope(changed, features, specs);

it('skips e2e when nothing rendered changed', () => {
	expect(scope('scripts/canary.ts', '.github/workflows/ci.yml', 'src/routes/api/sync/+server.ts', 'src/lib/server/sync.ts', 'src/lib/domain/plan.spec.ts')).toEqual([]);
});

it('runs only the specs that own the changed route, feature or spec', () => {
	expect(scope('src/routes/progress/lifts/[id]/+page.svelte')).toEqual(['e2e/progress.e2e.ts']);
	expect(scope('src/lib/features/plan/Plan.svelte', 'src/routes/+page.server.ts')).toEqual(['e2e/plan.desktop.e2e.ts', 'e2e/today.e2e.ts']);
	expect(scope('e2e/pwa.e2e.ts')).toEqual(['e2e/pwa.e2e.ts']);
});

it('runs everything when a change is shared or unowned', () => {
	expect(scope('src/lib/ui/tokens.css')).toBe('all');
	expect(scope('src/routes/+layout.svelte')).toBe('all');
	expect(scope('e2e/evidence.ts')).toBe('all');
	expect(scope('data/curated/results.json')).toBe('all');
});
