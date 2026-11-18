import { describe, expect, it } from 'vitest';
import week from '../../../../fixtures/plan/week-01.json' with { type: 'json' };
import { PlanWeek } from '#lib/domain/plan.ts';
import { logSteps, nextLabel, repsTarget, stepTitle } from './steps.ts';

const [monday, tuesday] = PlanWeek.parse(week);

describe('logSteps', () => {
	const steps = logSteps(monday!);

	it('steps through percent and fixed sets in plan order and skips non-set work', () => {
		expect(steps.map((s) => [s.blockIndex, s.prescriptionIndex, s.setIndex])).toEqual([
			[1, 0, 0], [1, 0, 1], [1, 0, 2],
			[1, 1, 0], [1, 1, 1], [1, 1, 2], [1, 1, 3], [1, 1, 4],
			[1, 2, 0], [1, 2, 1], [1, 2, 2], [1, 2, 3], [1, 2, 4]
		]);
		expect(logSteps(tuesday!)).toEqual([]);
	});

	it('loads each percent set from the training max and keeps bodyweight sets unloaded', () => {
		expect(steps.slice(0, 3).map((s) => [s.load, s.reps, s.amrap])).toEqual([
			[170, 5, false],
			[200, 5, false],
			[225, 5, true]
		]);
		expect(steps[8]).toMatchObject({ movement: 'pull_up', reps: 6, amrap: false });
		expect(steps[8]).not.toHaveProperty('load');
	});

	it('names the set in context and the target reps', () => {
		expect(stepTitle(steps[2]!)).toBe('Back squat · 3 of 3');
		expect(repsTarget(steps[2]!)).toBe('5 or more reps');
		expect(repsTarget(steps[0]!)).toBe('5 reps');
		expect(stepTitle(steps[8]!)).toBe('Pull-up · 1 of 5');
	});

	it('labels the next set: a new group by its summary, the same group by its set', () => {
		expect(nextLabel(steps, 0)).toBe('200 × 5');
		expect(nextLabel(steps, 1)).toBe('225 × 5+');
		expect(nextLabel(steps, 2)).toBe('5 × 5 at 170');
		expect(nextLabel(steps, 7)).toBe('Pull-ups 5 × 6');
		expect(nextLabel(steps, 8)).toBe('6 pull-ups');
		expect(nextLabel(steps, steps.length - 1)).toBeUndefined();
	});
});
