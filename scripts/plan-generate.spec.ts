import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlanInputs } from '#lib/domain/evolution.ts';
import { freeTextInWorkBlocks, isHardSession, type PlanSession, type PlanWeek } from '#lib/domain/plan.ts';
import { wendlerSet } from '#lib/domain/strength.ts';
import { weekdayShort } from '#lib/domain/calendar.ts';
import { planDir, readInputs, renderPlan } from './plan-generate.ts';
import { generatePlan, weeklyRunMinutes } from './plan-sessions.ts';

const inputs = readInputs();
const plan = generatePlan(inputs);
const week = (n: number): PlanWeek => plan[n - 1] ?? [];
const on = (date: string) => plan.flat().find((s) => s.date === date);
const blockOf = (session: PlanSession | undefined, name: string) => session?.blocks.find((b) => b.name === name);
const loads = (session: PlanSession | undefined, name: string) =>
	blockOf(session, name)?.prescriptions.map((p) =>
		p.kind === 'percentSets' ? p.sets.map((s) => `${wendlerSet(p.trainingMax, s.pct)}×${s.reps}${s.amrap ? '+' : ''}`).join(' ') : p.kind
	);
const days = (sessions: PlanWeek) => sessions.map((s) => weekdayShort(s.date));

it('rebuilds the committed plan/ byte for byte (run pnpm plan:generate)', () => {
	for (const [name, content] of Object.entries(renderPlan(inputs))) {
		expect(content, name).toBe(readFileSync(path.join(planDir, name), 'utf8'));
	}
});

describe('the generated plan', () => {
	it('has 17 weeks from Mon 2026-12-07 to Sat 2027-04-03, every session Mon–Sat', () => {
		expect(plan).toHaveLength(17);
		expect(plan.flat()[0]?.date).toBe('2026-12-07');
		expect(plan.flat().at(-1)?.date).toBe('2027-04-03');
		expect(plan.flat().filter((s) => weekdayShort(s.date) === 'Sun')).toEqual([]);
	});

	it('opens with week 1 Monday: squat 5s PRO and FSL 5 × 5 from TM 215, then a hard couplet', () => {
		const monday = on('2026-12-07');
		expect(monday?.title).toBe('Squat + couplet');
		expect(loads(monday, 'Back squat')).toEqual(['140×5 160×5 185×5', '140×5 140×5 140×5 140×5 140×5']);
		expect(monday?.blocks.filter((b) => b.hard).map((b) => b.name)).toEqual(['Couplet']);
	});

	it('deloads every lift in week 7 at 40/50/60 × 5 with no FSL', () => {
		expect(loads(on('2027-01-18'), 'Back squat')).toEqual(['95×5 120×5 140×5']);
		expect(loads(on('2027-01-19'), 'Shoulder press')).toEqual(['60×5 75×5 85×5']);
		expect(loads(on('2027-01-22'), 'Deadlift')).toEqual(['120×5 150×5 180×5']);
	});

	it('tests the training max in week 11 with a 3+ set at 100% and the −10% rule in the notes', () => {
		const squat = blockOf(on('2027-02-15'), 'Back squat');
		expect(loads(on('2027-02-15'), 'Back squat')).toEqual(['170×5 195×5 220×5 245×3+']);
		expect(squat?.notes).toBe('Fewer than 3 reps at 100% → TM −10%');
		expect(loads(on('2027-02-19'), 'Deadlift')).toEqual(['215×5 250×5 280×5 310×3+']);
	});

	it('marks the Anchor 3+ weeks as a rep goal', () => {
		expect(blockOf(on('2027-02-01'), 'Back squat')?.notes).toMatch(/^Rep goal: leave one in the tank/);
		expect(loads(on('2027-02-01'), 'Back squat')).toEqual(['165×3 190×3 210×3+', '165×5 165×5 165×5']);
	});

	it('shifts the holiday weeks: Thursday easy on Wednesday, Friday on Thursday, no Quality A', () => {
		expect(week(3).map((s) => `${weekdayShort(s.date)} ${s.title}`)).toEqual([
			'Mon Squat + intervals', 'Tue Press + Z1 run', 'Wed Z1 run + gymnastics', 'Thu Deadlift + bike', 'Sat Long run'
		]);
		expect(week(4).map((s) => `${weekdayShort(s.date)} ${s.title}`)).toEqual([
			'Mon Squat + Grace', 'Tue Press + checkpoint tests', 'Wed Z1 bike + gymnastics', 'Thu Mile TT + deadlift', 'Sat Long run'
		]);
		expect(on('2026-12-25')).toBeUndefined();
		expect(on('2027-01-01')).toBeUndefined();
	});

	it('lays out the retest in weeks 16 and 17', () => {
		expect(week(16).map((s) => `${weekdayShort(s.date)} ${s.title}`)).toEqual([
			'Mon CrossFit Total + pull-ups', 'Tue Submax + gymnastics tests', 'Wed 400 m + Grace',
			'Thu 2-mile bike', 'Fri Mile + Cindy', 'Sat Jason Cunningham'
		]);
		expect(week(17).map((s) => `${weekdayShort(s.date)} ${s.title} ${s.location}`)).toEqual([
			'Mon 10k home', 'Tue Amanda rec', 'Wed Row 5k rec', 'Thu Fran home', 'Sat Diane home'
		]);
	});

	it('puts hard sessions on Mon/Wed/Fri, Mon/Thu in the holiday weeks, and on every max test', () => {
		const hardDays = plan.map((sessions) => days(sessions.filter(isHardSession)).join(' '));
		expect(hardDays).toEqual([
			'Mon Wed Fri', 'Mon Wed Fri', 'Mon Thu', 'Mon Thu',
			...Array(11).fill('Mon Wed Fri'),
			'Mon Tue Wed Thu Fri Sat', 'Mon Tue Wed Thu Sat'
		]);
	});

	it('runs four times a week, three in the holiday weeks', () => {
		const runs = (sessions: PlanWeek) =>
			sessions.filter((s) => s.blocks.some((b) => b.kind === 'conditioning' && b.prescriptions.some((p) => (p.kind === 'steady' && p.movement === 'run') || ('movements' in p && p.movements.some((m) => m.movement === 'run'))))).length;
		expect(plan.slice(0, 15).map(runs)).toEqual([4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
	});

	it('follows the long-run progression on Saturdays', () => {
		const longRuns = plan.slice(0, 15).map((sessions) => sessions.at(-1)?.blocks[0]);
		expect(longRuns.map((b) => b?.minutes)).toEqual([58, 63, 68, 73, 78, 83, 66, 88, 90, 90, 90, 90, 90, 90, 72]);
		expect(longRuns[0]?.notes).toBe('9:49/mi or slower · HR <75% max · RPE ≤3');
	});

	it('keeps weekly run time within +10% of the last full week, from a 135-minute week 0', () => {
		let base = 135;
		for (const [i, sessions] of plan.slice(0, 15).entries()) {
			const minutes = weeklyRunMinutes(sessions);
			expect(minutes, `week ${i + 1}`).toBeLessThanOrEqual(Math.floor(1.1 * base));
			if (![3, 4, 7, 15].includes(i + 1)) base = minutes;
		}
	});

	it('sets pull-ups at half the latest strict max and tests the max weekly', () => {
		const wednesday = blockOf(on('2026-12-09'), 'Pull-ups');
		expect(wednesday?.prescriptions[0]).toEqual({ kind: 'fixedSets', movement: 'pull_up', sets: 5, reps: 6 });
		expect(blockOf(on('2027-01-27'), 'Pull-ups')?.prescriptions[0]).toEqual({ kind: 'fixedSets', movement: 'pull_up', sets: 8, reps: 6 });
		expect(blockOf(on('2026-12-10'), 'Pull-up max')?.prescriptions).toEqual([{ kind: 'fixedSets', movement: 'pull_up', sets: 1, reps: 13 }]);
	});

	it('measures body comp first thing on Tuesday of weeks 1/5/9/13 only, as a 1-min non-hard block', () => {
		const measured = plan.flat().filter((s) => s.blocks.some((b) => b.name === 'Body comp'));
		expect(measured.map((s) => `${s.week} ${weekdayShort(s.date)}`)).toEqual(['1 Tue', '5 Tue', '9 Tue', '13 Tue']);
		for (const session of measured) {
			expect(session.blocks[0]).toEqual({
				name: 'Body comp', kind: 'warmup', minutes: 1, hard: false,
				prescriptions: [{ kind: 'freeText', text: 'Fasted, before eating: weight · tape' }]
			});
		}
	});

	it('runs the §G checkpoint on Tuesday of weeks 4/8/12: submax, then max L-sit, ring dips and push-ups, none hard', () => {
		const tested = plan.flat().filter((s) => s.blocks.some((b) => b.name === 'Gymnastics maxes'));
		expect(tested.map((s) => `${s.week} ${weekdayShort(s.date)} ${s.title}`)).toEqual([
			'4 Tue Press + checkpoint tests', '8 Tue Press + checkpoint tests', '12 Tue Press + checkpoint tests'
		]);
		for (const session of tested) {
			expect(session.blocks.map((b) => b.name)).toEqual(['Warm-up', 'Shoulder press', 'Submax run', 'Gymnastics maxes']);
			const maxes = blockOf(session, 'Gymnastics maxes');
			expect(maxes?.hard).toBe(false);
			expect(maxes?.prescriptions.map((p) => ('movements' in p ? p.movements.map((m) => m.movement).join() : `${p.kind} ${'movement' in p ? p.movement : ''}`))).toEqual(['l_sit', 'maxReps dip', 'fixedSets push_up']);
			expect(maxes?.notes).toMatch(/max L-sit.*ring dips.*max push-ups/);
		}
	});

	it('keeps the pull-up sets every training week; in the holiday weeks they follow Wednesday’s max set', () => {
		const pullUpWeeks = plan.slice(0, 15).map((sessions) => sessions.filter((s) => blockOf(s, 'Pull-ups')).map((s) => weekdayShort(s.date)).join());
		expect(pullUpWeeks).toEqual(Array(15).fill('Wed'));
		for (const n of [3, 4]) {
			const names = week(n).find((s) => blockOf(s, 'Pull-ups'))?.blocks.map((b) => b.name);
			expect(names?.slice(-2)).toEqual(['Pull-up max', 'Pull-ups']);
		}
	});

	it('uses freeText only in warm-ups and cool-downs, and keeps notes free of the sets', () => {
		expect(freeTextInWorkBlocks(plan.flat())).toEqual([]);
		const notes = plan.flat().flatMap((s) => s.blocks.flatMap((b) => (b.notes ? [b.notes] : [])));
		expect(notes.filter((n) => /\d+ × \d+ at|\d{2,3} × \d/.test(n) && !n.startsWith('Broad jumps'))).toEqual([]);
	});
});

describe('missing and provisional inputs', () => {
	it('writes paces from a missing mile or HR max as relative text, and as numbers once logged', () => {
		const bombolini = (i: PlanInputs) => blockOf(generatePlan(i)[1]?.find((s) => s.title.startsWith('Bombolini')), 'Bombolini')?.notes;
		expect(bombolini(inputs)).toContain('500 m midway between mile and 400 pace, 100 m 0:16.4');
		const logged = PlanInputs.parse({
			...inputs,
			tests: {
				...inputs.tests,
				mileSeconds: { value: 330, date: '2026-11-20', provisional: false },
				hrMax: { value: 190, date: '2026-11-20', provisional: false },
				ringDips: { value: 12, date: '2026-11-17', provisional: false }
			}
		});
		expect(bombolini(logged)).toContain('500 m 1:33, 100 m 0:16.4');
		const dipsMax = (i: PlanInputs) => blockOf(generatePlan(i)[3]?.find((s) => blockOf(s, 'Gymnastics maxes')), 'Gymnastics maxes')?.prescriptions[1];
		expect(dipsMax(inputs)).toEqual({ kind: 'maxReps', movement: 'dip' });
		expect(dipsMax(logged)).toEqual({ kind: 'fixedSets', movement: 'dip', sets: 1, reps: 12 });
		const tuesday = generatePlan(logged)[0]?.[1];
		expect(blockOf(tuesday, 'Z1 run')?.notes).toBe('9:49/mi or slower · HR <142 · RPE ≤3');
		expect(blockOf(generatePlan(logged)[0]?.[2], '3 × 10 min')?.notes).toBe('8:49–8:53/mi · HR 162–171 ceiling');
		const ladder = blockOf(generatePlan(logged)[5]?.find((s) => s.title.startsWith('Ladder')), 'Ladder')?.notes;
		expect(ladder).toContain('no faster than 1:54/1:16/0:57.0/0:38.0');
		expect(blockOf(on('2026-12-11'), 'Bike intervals')?.notes).toBe('Each ≥0.40 mi');
		expect(blockOf(tuesday, 'Gymnastics')?.prescriptions[1]).toEqual({ kind: 'fixedSets', movement: 'dip', sets: 4, reps: 6 });
	});

	it('marks the not-yet-retested inputs provisional', () => {
		const provisional = Object.entries(inputs.tests).filter(([, t]) => t?.provisional).map(([name]) => name);
		expect(provisional).toEqual(['run10kSeconds', 'run400Seconds', 'bike2MileSeconds', 'lSitSeconds']);
	});
});
