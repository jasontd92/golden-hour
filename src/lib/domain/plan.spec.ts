import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { freeTextInWorkBlocks, PlanSession, PlanWeek, sessionMinutes } from './plan.ts';

const weekOne: unknown = JSON.parse(
	readFileSync(new URL('../../../plan/week-01.json', import.meta.url), 'utf8')
);

describe('plan/week-01.json', () => {
	const week = PlanWeek.parse(weekOne);

	it('parses without loss', () => {
		expect(week).toStrictEqual(weekOne);
	});

	it('is Mon 2026-12-07 to Sat 2026-12-12; Sunday is rest', () => {
		expect(week.map((s) => s.date)).toStrictEqual([
			'2026-12-07',
			'2026-12-08',
			'2026-12-09',
			'2026-12-10',
			'2026-12-11',
			'2026-12-12'
		]);
		expect(week.map(sessionMinutes)).toSatisfy((minutes: number[]) => minutes.every((m) => m > 0));
	});

	it('uses freeText only in warm-ups and cool-downs', () => {
		expect(freeTextInWorkBlocks(week)).toStrictEqual([]);
	});
});

describe('PlanSession rejects what the debate must not emit', () => {
	const session = PlanSession.parse((weekOne as unknown[])[0]);
	const withBlock = (prescription: unknown) => ({
		...session,
		blocks: [{ name: 'X', kind: 'metcon', minutes: 10, hard: true, prescriptions: [prescription] }]
	});

	it('an unknown prescription kind or key', () => {
		expect(PlanSession.safeParse(withBlock({ kind: 'tabata', movements: [] })).success).toBe(false);
		expect(PlanSession.safeParse(withBlock({ kind: 'freeText', text: 'x', load: 5 })).success).toBe(false);
	});

	it('a movement outside data/curated/movements.json', () => {
		expect(PlanSession.safeParse(withBlock({ kind: 'amrap', minutes: 5, movements: [{ movement: 'moonwalk', reps: 5 }] })).success).toBe(false);
	});

	it('a movement with no amount, or two', () => {
		const amrap = (work: object) => withBlock({ kind: 'amrap', minutes: 5, movements: [{ movement: 'run', ...work }] });
		expect(PlanSession.safeParse(amrap({ meters: 200 })).success).toBe(true);
		expect(PlanSession.safeParse(amrap({})).success).toBe(false);
		expect(PlanSession.safeParse(amrap({ meters: 200, seconds: 60 })).success).toBe(false);
	});

	it('a week outside the 17-week evolution', () => {
		expect(PlanSession.safeParse({ ...session, week: 17 }).success).toBe(true);
		expect(PlanSession.safeParse({ ...session, week: 18 }).success).toBe(false);
		expect(PlanSession.safeParse({ ...session, week: 0 }).success).toBe(false);
	});

	it('a week file out of order, spanning more than seven days, or mixing weeks', () => {
		const on = (date: string, week = 1) => ({ ...session, date, week });
		expect(PlanWeek.safeParse([on('2026-12-07'), on('2026-12-13')]).success).toBe(true);
		expect(PlanWeek.safeParse([on('2026-12-08'), on('2026-12-07')]).success).toBe(false);
		expect(PlanWeek.safeParse([on('2026-12-07'), on('2026-12-07')]).success).toBe(false);
		expect(PlanWeek.safeParse([on('2026-12-07'), on('2026-12-14')]).success).toBe(false);
		expect(PlanWeek.safeParse([on('2026-12-07'), on('2026-12-08', 2)]).success).toBe(false);
	});
});
