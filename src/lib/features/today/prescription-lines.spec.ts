import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlanWeek, type Block, type Prescription } from '#lib/domain/plan.ts';
import { dayLog, type LogRecord, type SessionRecord } from '#lib/domain/log.ts';
import { blockLines, distance, duration, loggedText, movementLine } from './prescription-lines.ts';

const planWeek = (week: string) => PlanWeek.parse(JSON.parse(readFileSync(`plan/week-${week}.json`, 'utf8')));
const blockNamed = (week: string, date: string, name: string) =>
	planWeek(week)
		.find((s) => s.date === date)
		?.blocks.find((b) => b.name === name);
const linesOf = (block: Block | undefined) => (block ? blockLines(block).map(({ text, tone }) => ({ text, tone })) : []);
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

const set = (blockIndex: number, setIndex: number, reps: number, minute = 0, prescriptionIndex = 0): LogRecord => ({
	id: `01938a5e-0000-7000-8000-${String(prescriptionIndex * 1000 + blockIndex * 100 + setIndex * 10 + minute).padStart(12, '0')}`,
	sessionDate: '2026-12-07',
	blockIndex,
	prescriptionIndex,
	setIndex,
	movement: 'back_squat',
	reps,
	loggedAt: `2026-12-07T10:0${minute}:00Z`,
	deviceId: 'd',
	revision: 1
});

const sessionRecord = (score?: SessionRecord['score']): SessionRecord => ({
	kind: 'session',
	id: '01938a5e-0000-7000-8000-000000009999',
	sessionDate: '2026-12-07',
	rpe: 8,
	...(score ? { score } : {}),
	loggedAt: '2026-12-07T11:00:00Z',
	deviceId: 'd',
	revision: 1
});

describe('loggedText', () => {
	const squat = blockNamed('01', '2026-12-07', 'Back squat');

	it('puts the logged reps beside each set line, and every set of a collapsed group on its line', () => {
		if (!squat) throw new Error('no squat block');
		const log = dayLog([set(1, 0, 5), set(1, 1, 5), set(1, 2, 7), set(1, 0, 5, 3, 1), set(1, 1, 4, 4, 1)], '2026-12-07');
		expect(blockLines(squat).map((line) => loggedText(line, 1, log))).toEqual(['✓ 5', '✓ 5', '✓ 7', '✓ 5/4']);
	});

	it('shows nothing for sets that are not logged, and the latest of a set logged twice', () => {
		if (!squat) throw new Error('no squat block');
		const log = dayLog([set(1, 2, 9, 2), set(1, 2, 6, 1)], '2026-12-07');
		expect(blockLines(squat).map((line) => loggedText(line, 1, log))).toEqual([undefined, undefined, '✓ 9', undefined]);
		expect(blockLines(squat).map((line) => loggedText(line, 0, log))).toEqual([undefined, undefined, undefined, undefined]);
	});

	it("puts the session score on the scored prescription's first line", () => {
		const fran = work('Fran', [{ kind: 'forTime', rounds: 1, movements: [{ movement: 'thruster', reps: 21, load: 95 }] }]);
		const log = dayLog([sessionRecord({ blockIndex: 2, prescriptionIndex: 0, type: 'time', value: 283 })], '2026-12-07');
		expect(blockLines(fran).map((line) => loggedText(line, 2, log))).toEqual(['✓ 4:43', undefined]);
		expect(blockLines(fran).map((line) => loggedText(line, 1, log))).toEqual([undefined, undefined]);
		expect(blockLines(fran).map((line) => loggedText(line, 2, dayLog([sessionRecord()], '2026-12-07')))).toEqual([undefined, undefined]);
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
