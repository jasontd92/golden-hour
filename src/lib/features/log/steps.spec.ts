import { describe, expect, it } from 'vitest';
import week from '../../../../plan/week-08.json' with { type: 'json' };
import { PlanWeek } from '#lib/domain/plan.ts';
import { logSteps, nextLabel, repsTarget, stepTitle } from './steps.ts';

const sessions = PlanWeek.parse(week);
const monday = sessions[0];
const saturday = sessions.at(-1);

describe('logSteps', () => {
	const steps = logSteps(monday!);

	it('steps through percent and fixed sets in plan order and skips non-set work', () => {
		expect(steps.map((s) => [s.blockIndex, s.prescriptionIndex, s.setIndex])).toEqual([
			[1, 0, 0], [1, 0, 1], [1, 0, 2],
			[1, 1, 0], [1, 1, 1], [1, 1, 2],
			[3, 0, 0], [3, 0, 1], [3, 0, 2]
		]);
		expect(logSteps(saturday!)).toEqual([]);
	});

	it('loads each percent set from the training max and keeps bodyweight sets unloaded', () => {
		expect(steps.slice(0, 3).map((s) => [s.load, s.reps, s.amrap])).toEqual([
			[155, 5, false],
			[175, 5, false],
			[200, 5, true]
		]);
		expect(steps[6]).toMatchObject({ movement: 'lunge', reps: 10, amrap: false });
		expect(steps[6]).not.toHaveProperty('load');
	});

	it('names the set in context and the target reps', () => {
		expect(stepTitle(steps[2]!)).toBe('Back squat · 3 of 3');
		expect(repsTarget(steps[2]!)).toBe('5 or more reps');
		expect(repsTarget(steps[0]!)).toBe('5 reps');
		expect(stepTitle(steps[6]!)).toBe('Lunge · 1 of 3');
	});

	it('labels the next set: a new group by its summary, the same group by its set', () => {
		expect(nextLabel(steps, 0)).toBe('175 × 5');
		expect(nextLabel(steps, 1)).toBe('200 × 5+');
		expect(nextLabel(steps, 2)).toBe('3 × 5 at 155');
		expect(nextLabel(steps, 5)).toBe('Lunges 3 × 10');
		expect(nextLabel(steps, 6)).toBe('10 lunges');
		expect(nextLabel(steps, steps.length - 1)).toBeUndefined();
	});
});

describe('a max set with no target', () => {
	const checkpoint = sessions[1]!;
	const dips = logSteps(checkpoint).find((s) => s.movement === 'dip');

	it('logs the ring-dip max as one set with no target, counted up from zero', () => {
		expect(dips).toMatchObject({ blockIndex: 3, prescriptionIndex: 1, setIndex: 0, setCount: 1, amrap: true, groupSummary: 'Max dips' });
		expect(dips).not.toHaveProperty('reps');
		expect(repsTarget(dips!)).toBe('max reps');
		expect(stepTitle(dips!)).toBe('Dip · 1 of 1');
	});

	it('is announced by its summary as the next set', () => {
		const steps = logSteps(checkpoint);
		expect(nextLabel(steps, steps.findIndex((s) => s.movement === 'dip') - 1)).toBe('Max dips');
	});
});
