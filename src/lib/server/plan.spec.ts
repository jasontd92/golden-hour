import { describe, expect, it } from 'vitest';
import { loadPlan } from './plan.ts';

describe('loadPlan', () => {
	it('reads all 17 plan weeks at build time, in date order', () => {
		const plan = loadPlan();
		expect(plan[0]).toMatchObject({ date: '2026-12-07', week: 1, title: 'Squat + couplet' });
		expect(plan.at(-1)).toMatchObject({ date: '2027-04-03', week: 17, title: 'Diane' });
		expect(plan.map((s) => s.date)).toEqual(plan.map((s) => s.date).toSorted());
	});

	it('fails the build on a file that is not a PlanWeek', () => {
		expect(() => loadPlan({ '/plan/week-bad.json': [{ date: 'Monday' }] })).toThrow('/plan/week-bad.json');
	});
});
