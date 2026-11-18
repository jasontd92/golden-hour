import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlanWeek, type Block } from '#lib/domain/plan.ts';
import { blockLines, movementLine } from './prescription-lines.ts';

const week1 = PlanWeek.parse(JSON.parse(readFileSync('fixtures/plan/week-01.json', 'utf8')));
const blocksOn = (date: string) => week1.find((s) => s.date === date)?.blocks ?? [];
const linesOf = (block: Block | undefined) => (block ? blockLines(block) : []);

describe('blockLines', () => {
	it("renders Monday's squat block like the mockup: loads from the training max, AMRAP set strong", () => {
		expect(linesOf(blocksOn('2026-12-07')[1])).toEqual([
			{ text: '170 × 5', tone: 'plain' },
			{ text: '200 × 5', tone: 'plain' },
			{ text: '225 × 5+', tone: 'strong' },
			{ text: '5 × 5 at 170', tone: 'plain' },
			{ text: 'Pull-ups 5 × 6', tone: 'plain' },
			{ text: 'Strict pull-ups between the 5 × 5 sets', tone: 'quiet' }
		]);
	});

	it('lists AMRAP movements without repeating the block name', () => {
		expect(linesOf(blocksOn('2026-12-07')[2]).map((l) => l.text)).toEqual([
			'8 DB snatches, 45 lb',
			'10 box jumps, 24"',
			'200 m run',
			'Aim for 5+ rounds'
		]);
	});

	it('heads interval, for-time and steady work with its scheme', () => {
		expect(linesOf(blocksOn('2026-12-10')[1]).map((l) => l.text)).toEqual([
			'6 rounds · 90 s rest',
			'400 m run',
			'Mile pace or slower'
		]);
		expect(linesOf(blocksOn('2026-12-12')[1])[0]).toEqual({ text: 'For time · 30 min cap', tone: 'quiet' });
		expect(linesOf(blocksOn('2026-12-08')[0])[0]).toEqual({ text: '35 min run', tone: 'plain' });
	});

	it('keeps free text quiet', () => {
		expect(linesOf(blocksOn('2026-12-07')[3])).toEqual([{ text: 'Couch stretch · dead hang', tone: 'quiet' }]);
	});
});

describe('movementLine', () => {
	it('uses the singular for one rep and for distance, time and calories', () => {
		expect(movementLine({ movement: 'burpee', reps: 1 })).toBe('1 burpee');
		expect(movementLine({ movement: 'l_sit', seconds: 15 })).toBe('15 s L-sit');
		expect(movementLine({ movement: 'row', calories: 20 })).toBe('20 cal row');
	});
});
