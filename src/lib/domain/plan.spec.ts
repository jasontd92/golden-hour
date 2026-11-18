import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { freeTextInWorkBlocks, isHardSession, PlanSession, PlanWeek, sessionMinutes } from './plan.ts';
import { wendlerSet } from './strength.ts';

const weekOne: unknown = JSON.parse(
	readFileSync(new URL('../../../fixtures/plan/week-01.json', import.meta.url), 'utf8')
);

describe('fixtures/plan/week-01.json', () => {
	const week = PlanWeek.parse(weekOne);
	const [monday] = week;

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
		expect(week.filter(isHardSession).map((s) => s.title)).toStrictEqual([
			'Squat + short sprint',
			'Track intervals',
			'Long chipper'
		]);
	});

	it('Monday matches the Today mockup', () => {
		expect(monday?.blocks.map((b) => [b.name, b.minutes, b.hard])).toStrictEqual([
			['Warm-up', 8, false],
			['Back squat', 22, false],
			['AMRAP 12', 14, true],
			['Cool-down', 6, false]
		]);
		expect(monday && sessionMinutes(monday)).toBe(50);
		const [main, fsl, pullUps] = monday?.blocks[1]?.prescriptions ?? [];
		expect(main?.kind === 'percentSets' && main.sets.map((s) => [wendlerSet(main.trainingMax, s.pct), s.reps, s.amrap])).toStrictEqual([
			[170, 5, false],
			[200, 5, false],
			[225, 5, true]
		]);
		expect(fsl?.kind === 'percentSets' && fsl.sets.map((s) => wendlerSet(fsl.trainingMax, s.pct))).toStrictEqual([170, 170, 170, 170, 170]);
		expect(pullUps).toStrictEqual({ kind: 'fixedSets', movement: 'pull_up', sets: 5, reps: 6 });
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
