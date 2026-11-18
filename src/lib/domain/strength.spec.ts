import { describe, expect, it } from 'vitest';
import { estimatedOneRm, floorToPlate, roundToPlate, trainingMax, trainingMaxPct, wendlerSet } from './strength.ts';

describe('trainingMax follows team/draft-plan.md: FLOOR(0.85 × tested 1RM, 5)', () => {
	it('uses 85% by default', () => {
		expect(trainingMaxPct).toBe(0.85);
		expect(trainingMax(255)).toBe(215);
		expect(trainingMax(160)).toBe(135);
		expect(trainingMax(335)).toBe(280);
	});

	it('floors, never rounds up', () => {
		expect(trainingMax(295)).toBe(250);
		expect(trainingMax(295, 0.9)).toBe(265);
	});
});

describe('wendlerSet rounds to the nearest 5 lb', () => {
	it('gives the mockup week-1 squat sets for TM 265', () => {
		expect([0.65, 0.75, 0.85].map((pct) => wendlerSet(265, pct))).toStrictEqual([170, 200, 225]);
	});

	it('survives binary float error at a half step', () => {
		expect(175 * 0.7).toBeLessThan(122.5);
		expect(wendlerSet(175, 0.7)).toBe(125);
	});

	it('rounds halves up', () => {
		expect(roundToPlate(172.5)).toBe(175);
		expect(floorToPlate(174.9)).toBe(170);
	});
});

describe('estimatedOneRm is Wendler: w × r × 0.0333 + w', () => {
	it('rounds to the pound', () => {
		expect(estimatedOneRm(225, 7)).toBe(277);
		expect(estimatedOneRm(200, 5)).toBe(233);
	});

	it('is the load itself for a single', () => {
		expect(estimatedOneRm(315, 1)).toBe(325);
		expect(estimatedOneRm(315, 0)).toBe(315);
	});
});
