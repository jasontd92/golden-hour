import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlanWeek, type Block, type Prescription } from '#lib/domain/plan.ts';
import { blockLines, distance, duration, movementLine } from './prescription-lines.ts';

const planWeek = (week: string) => PlanWeek.parse(JSON.parse(readFileSync(`plan/week-${week}.json`, 'utf8')));
const blockNamed = (week: string, date: string, name: string) =>
	planWeek(week)
		.find((s) => s.date === date)
		?.blocks.find((b) => b.name === name);
const linesOf = (block: Block | undefined) => (block ? blockLines(block) : []);
const work = (name: string, prescriptions: Prescription[], notes?: string): Block => ({
	name,
	kind: 'metcon',
	minutes: 10,
	hard: true,
	prescriptions,
	...(notes ? { notes } : {})
});

describe('blockLines', () => {
	it('loads percent sets from the training max and collapses a uniform group', () => {
		expect(linesOf(blockNamed('01', '2026-12-07', 'Back squat'))).toEqual([
			{ text: '140 × 5', tone: 'plain' },
			{ text: '160 × 5', tone: 'plain' },
			{ text: '185 × 5', tone: 'plain' },
			{ text: '5 × 5 at 140', tone: 'plain' }
		]);
	});

	it('renders an AMRAP set strong and the block note quiet', () => {
		expect(linesOf(blockNamed('08', '2027-01-25', 'Back squat'))).toEqual([
			{ text: '155 × 5', tone: 'plain' },
			{ text: '175 × 5', tone: 'plain' },
			{ text: '200 × 5+', tone: 'strong' },
			{ text: '3 × 5 at 155', tone: 'plain' },
			{ text: 'PR set: stop a rep before a grind', tone: 'quiet' }
		]);
	});

	it('heads interval, for-time and steady work with its scheme, but not with the block name', () => {
		const amrap = work('AMRAP 12', [{ kind: 'amrap', minutes: 12, movements: [{ movement: 'burpee', reps: 10 }] }]);
		expect(linesOf(amrap).map((l) => l.text)).toEqual(['10 burpees']);
		const tempo = work('3 × 10 min', [{ kind: 'intervals', rounds: 3, restSeconds: 120, movements: [{ movement: 'run', seconds: 600 }] }], 'Easy');
		expect(linesOf(tempo).map((l) => l.text)).toEqual(['3 rounds · 2 min rest', '10 min run', 'Easy']);
		const capped = work('Chipper', [{ kind: 'forTime', rounds: 1, timeCapMinutes: 30, movements: [{ movement: 'run', meters: 800 }] }]);
		expect(linesOf(capped)[0]).toEqual({ text: 'For time · 30 min cap', tone: 'quiet' });
		expect(linesOf(work('Z1', [{ kind: 'steady', movement: 'run', minutes: 35 }]))[0]).toEqual({ text: '35 min run', tone: 'plain' });
	});

	it('drops the header of a single unrested interval, such as a max hold', () => {
		const hold = work('Max L-sit', [{ kind: 'intervals', rounds: 1, restSeconds: 0, movements: [{ movement: 'l_sit', seconds: 25 }] }]);
		expect(linesOf(hold).map((l) => l.text)).toEqual(['25 s L-sit']);
	});

	it('keeps free text quiet', () => {
		expect(linesOf(blockNamed('01', '2026-12-07', 'Cool-down'))).toEqual([{ text: 'Easy walk · stretch', tone: 'quiet' }]);
	});
});

describe('movementLine', () => {
	it('uses the singular for one rep and for distance, time and calories', () => {
		expect(movementLine({ movement: 'burpee', reps: 1 })).toBe('1 burpee');
		expect(movementLine({ movement: 'l_sit', seconds: 15 })).toBe('15 s L-sit');
		expect(movementLine({ movement: 'row', calories: 20 })).toBe('20 cal row');
	});
});

describe('distance and duration', () => {
	it('reads whole miles and whole kilometers in those units, everything else in meters', () => {
		expect([1609, 3219, 10000, 5000, 400, 1500].map(distance)).toEqual(['1 mi', '2 mi', '10 km', '5 km', '400 m', '1500 m']);
	});

	it('reads whole minutes in minutes, everything else in seconds', () => {
		expect([600, 120, 90, 45].map(duration)).toEqual(['10 min', '2 min', '90 s', '45 s']);
	});
});
