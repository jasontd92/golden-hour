import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlanWeek, type PlanSession } from './plan.ts';
import { focusDate, pickToday, planSessions, weekView } from './schedule.ts';

const week1 = PlanWeek.parse(JSON.parse(readFileSync('fixtures/plan/week-01.json', 'utf8')));
const plan = planSessions([week1]);
const titleOn = (date: string) => {
	const pick = pickToday(plan, date);
	return pick.kind === 'session' ? pick.session.title : 'Rest';
};

describe('pickToday', () => {
	it('shows the first session, flagged, before the plan starts', () => {
		const pick = pickToday(plan, '2026-11-17');
		expect(pick).toMatchObject({ kind: 'session', beforePlan: true, session: { date: '2026-12-07' } });
		expect(focusDate(pick)).toBe('2026-12-07');
	});

	it("picks the day's session, and rest on a day without one", () => {
		expect(titleOn('2026-12-07')).toBe('Squat + short sprint');
		expect(titleOn('2026-12-10')).toBe('Track intervals');
		expect(titleOn('2026-12-13')).toBe('Rest');
		expect(titleOn('2027-06-01')).toBe('Rest');
		expect(focusDate(pickToday(plan, '2026-12-13'))).toBe('2026-12-13');
	});

	it('rests when there is no plan at all', () => {
		expect(pickToday([], '2026-12-07')).toEqual({ kind: 'rest', date: '2026-12-07' });
	});
});

describe('weekView', () => {
	it('lays out Monday to Sunday with a missing day as rest', () => {
		const view = weekView(plan, '2026-12-09');
		expect(view?.week).toBe(1);
		expect(view?.days.map((d) => d.date)).toEqual([
			'2026-12-07',
			'2026-12-08',
			'2026-12-09',
			'2026-12-10',
			'2026-12-11',
			'2026-12-12',
			'2026-12-13'
		]);
		expect(view?.days.at(-1)?.session).toBeUndefined();
	});

	it('clamps to the first and last plan weeks', () => {
		expect(weekView(plan, '2026-11-17')?.days[0]?.date).toBe('2026-12-07');
		expect(weekView(plan, '2027-06-01')?.days[0]?.date).toBe('2026-12-07');
		expect(weekView([], '2026-12-07')).toBeUndefined();
	});
});

describe('planSessions', () => {
	const shift = (s: PlanSession, week: number, days: number): PlanSession => ({
		...s,
		week,
		date: new Date(Date.parse(`${s.date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
	});

	it('orders weeks by date whatever the file order', () => {
		const week2 = week1.map((s) => shift(s, 2, 7));
		expect(planSessions([week2, week1]).map((s) => s.week)).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
	});

	it('rejects two files that claim the same day', () => {
		expect(() => planSessions([week1, week1])).toThrow('plan has two sessions on 2026-12-07');
	});
});
