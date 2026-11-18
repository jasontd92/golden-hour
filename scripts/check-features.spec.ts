import { describe, expect, it } from 'vitest';
import { featureProblems, parseFeatures, routeOf } from './check-features.ts';

const today = { name: 'today', route: '/', e2e: 'e2e/today.e2e.ts' };

describe('routeOf', () => {
	it('maps page files to routes, dropping groups', () => {
		expect(routeOf('src/routes/+page.svelte')).toBe('/');
		expect(routeOf('src/routes/(app)/week/+page.svelte')).toBe('/week');
		expect(routeOf('src/routes/progress/[id]/+page.ts')).toBe('/progress/[id]');
		expect(routeOf('src/routes/+layout.svelte')).toBeUndefined();
		expect(routeOf('src/routes/api/+server.ts')).toBeUndefined();
	});
});

describe('check-features', () => {
	it('passes when every route has an entry and every entry resolves', () => {
		expect(featureProblems([today], ['src/routes/+page.svelte', 'e2e/today.e2e.ts'])).toEqual([]);
	});
	it('fails a route without an entry', () => {
		const problems = featureProblems([today], ['src/routes/+page.svelte', 'src/routes/week/+page.svelte', 'e2e/today.e2e.ts']);
		expect(problems).toEqual([
			"src/routes/week/+page.svelte: route '/week' has no features.yaml entry. Add { name, route: '/week', e2e: e2e/<name>.e2e.ts }."
		]);
	});
	it('fails an entry whose route or e2e file is missing', () => {
		const problems = featureProblems([{ name: 'week', route: '/week', e2e: 'e2e/week.e2e.ts' }], []);
		expect(problems).toHaveLength(2);
	});
	it('rejects malformed yaml entries', () => {
		expect(parseFeatures('- name: today\n  route: /\n').problems).toHaveLength(1);
		expect(parseFeatures('name: today').problems).toHaveLength(1);
		expect(parseFeatures('- name: today\n  route: /\n  e2e: e2e/today.e2e.ts\n').features).toEqual([today]);
	});
});
