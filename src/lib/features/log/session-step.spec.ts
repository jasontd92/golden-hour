import { describe, expect, it } from 'vitest';
import { clockDigits, readScore, scoreText } from './session-step.ts';

const fran = { blockIndex: 1, prescriptionIndex: 0, type: 'time' as const };
const cindy = { blockIndex: 2, prescriptionIndex: 0, type: 'rounds_reps' as const };

describe('readScore', () => {
	it('reads a time or rounds+reps with parseScore, and leaves an empty field unscored', () => {
		expect(readScore('4:05', fran)).toEqual({ ...fran, value: 245 });
		expect(readScore('12+7', cindy)).toEqual({ ...cindy, value: 12.007 });
		expect(readScore('19', cindy)).toEqual({ ...cindy, value: 19 });
		expect(readScore('  ', fran)).toBeUndefined();
	});

	it('flags what does not parse, or parses into nonsense', () => {
		for (const text of ['4', '4:5', 'fast', '4:65']) expect(readScore(text, fran), text).toBe('invalid');
		for (const text of ['12+', '12+1000', '5:00', 'x']) expect(readScore(text, cindy), text).toBe('invalid');
	});

	it('shows a saved score the way it was typed', () => {
		expect(scoreText({ ...fran, value: 245 })).toBe('4:05');
		expect(scoreText({ ...cindy, value: 12.007 })).toBe('12+7');
	});
});

describe('clockDigits', () => {
	it('fills a clock from the right as digits are typed, and backs out the same way', () => {
		const typed = ['', '1', '12', '123', '1234'].map((digits) => clockDigits(digits));
		expect(typed).toEqual(['', '0:01', '0:12', '1:23', '12:34']);
		expect(clockDigits('0:012')).toBe('0:12');
		expect(clockDigits('12:3')).toBe('1:23');
		expect(clockDigits('12:345')).toBe('12:34');
	});
});
