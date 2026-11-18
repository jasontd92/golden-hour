import { describe, expect, it } from 'vitest';
import { loadPlan } from './plan.ts';

describe('loadPlan', () => {
	it('reads every fixtures/plan week at build time, in date order', () => {
		const plan = loadPlan();
		expect(plan[0]).toMatchObject({ date: '2026-12-07', title: 'Squat + short sprint' });
		expect(plan.map((s) => s.date)).toEqual(plan.map((s) => s.date).toSorted());
	});

	it('fails the build on a file that is not a PlanWeek', () => {
		expect(() => loadPlan({ '/fixtures/plan/bad.json': [{ date: 'Monday' }] })).toThrow('/fixtures/plan/bad.json');
	});
});
