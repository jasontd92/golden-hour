import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlanWeek, type PlanSession } from './plan.ts';
import {
	attemptDates,
	columnNames,
	loggedDates,
	nextAttempt,
	planGrid,
	trainingMaxByWeek,
	weekSummary
} from './plan-grid.ts';
import { planSessions } from './schedule.ts';

const plan: PlanSession[] = planSessions(
	readdirSync('plan')
		.filter((file) => /^week-\d+\.json$/.test(file))
		.map((file) => PlanWeek.parse(JSON.parse(readFileSync(`plan/${file}`, 'utf8'))))
);

const day = (date: string) => planGrid(plan).flatMap((w) => w.days).find((d) => d.date === date);

describe('planGrid', () => {
	it('lays out every plan week as Mon–Sat rows grouped by phase', () => {
		const grid = planGrid(plan);
		expect(grid.map((w) => w.week)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
		expect(grid.every((w) => w.days.length === 6)).toBe(true);
		expect(grid.filter((w) => w.firstOfPhase).map((w) => `${w.week} ${w.phase}`)).toEqual([
			'1 Leader',
			'7 Deload',
			'8 Anchor',
			'11 TM test',
			'12 Anchor',
			'15 Deload',
			'16 Retest'
		]);
	});

	it('renders only the weeks that exist', () => {
		const firstWeek = plan.filter((s) => s.week === 1);
		expect(planGrid(firstWeek).map((w) => w.week)).toEqual([1]);
		expect(planGrid([])).toEqual([]);
	});

	it('marks hard days, scaled weeks, tests and holidays', () => {
		expect(day('2026-12-07')).toMatchObject({ hard: true, scaled: true, test: undefined });
		expect(day('2026-12-08')).toMatchObject({ hard: false, scaled: false });
		expect(day('2026-12-28')).toMatchObject({ hard: true, scaled: false, test: 'Grace' });
		expect(day('2026-12-29')?.test).toBe('Submax');
		expect(day('2026-12-31')?.test).toBe('Mile TT');
		expect(day('2026-12-25')).toMatchObject({ session: undefined, holiday: 'Christmas' });
		expect(day('2027-01-01')).toMatchObject({ session: undefined, holiday: "New Year's" });
		expect(day('2027-03-22')?.test).toBe('CFT');
		expect(day('2026-12-24')).toMatchObject({ test: undefined, moved: 'Deadlift + bike' });
		expect(day('2026-12-23')?.moved).toBe('Z1 run + gymnastics');
		expect(day('2026-12-11')?.moved).toBeUndefined();
		expect(day('2027-04-02')?.session).toBeUndefined();
	});
});

describe('columnNames', () => {
	it("names each weekday's constant session from the titles", () => {
		expect(columnNames(plan)).toEqual(['Squat', 'Press', 'Threshold intervals', 'Gymnastics', 'Deadlift', 'Long run']);
	});
});

describe('weekSummary', () => {
	it('gives the scheme, the three training maxes, the long run and the planned count', () => {
		expect(weekSummary(plan, 1)).toEqual({
			week: 1,
			phase: 'Leader',
			monday: '2026-12-07',
			sunday: '2026-12-13',
			scheme: '65/75/85% × 5',
			trainingMaxes: [
				{ lift: 'back_squat', value: 215 },
				{ lift: 'shoulder_press', value: 135 },
				{ lift: 'deadlift', value: 280 }
			],
			longRunMinutes: 58,
			tests: 0,
			planned: 6
		});
		expect(weekSummary(plan, 8)?.scheme).toBe('65/75/85% × 5+');
		expect(weekSummary(plan, 10)?.scheme).toBe('75/85/95% × 5/3/1+');
		expect(weekSummary(plan, 17)).toMatchObject({ scheme: undefined, longRunMinutes: undefined, tests: 5, planned: 5 });
		expect(weekSummary(plan, 18)).toBeUndefined();
	});
});

describe('attempts', () => {
	it('finds when a benchmark or lift is next tested', () => {
		expect(attemptDates(plan, 'benchmark', 'fran').map((s) => s.week)).toEqual([8, 17]);
		expect(nextAttempt(plan, 'benchmark', 'fran', '2027-01-26')).toBe(17);
		expect(attemptDates(plan, 'benchmark', 'max-l-sit').map((s) => s.week)).toEqual([4, 8, 12, 16]);
		expect(nextAttempt(plan, 'lift', 'back-squat', '2026-11-18')).toBe(16);
		expect(nextAttempt(plan, 'benchmark', 'turkey-trot-triple', '2026-11-18')).toBeUndefined();
	});

	it('steps the training max week by week from the plan', () => {
		const squat = trainingMaxByWeek(plan, 'back_squat');
		expect(squat[0]).toEqual({ week: 1, value: 215 });
		expect(squat.find((w) => w.week === 4)?.value).toBe(225);
		expect(squat.some((w) => w.week >= 16)).toBe(false);
	});
});

describe('loggedDates', () => {
	it('keys any record with a session date', () => {
		expect([...loggedDates([{ sessionDate: '2026-12-07' }, { sessionDate: '2026-12-07' }, { sessionDate: '2026-12-09' }])]).toEqual([
			'2026-12-07',
			'2026-12-09'
		]);
	});
});
