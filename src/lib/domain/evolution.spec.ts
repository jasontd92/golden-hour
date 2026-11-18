import { describe, expect, it } from 'vitest';
import {
	bikeFamily,
	bodyCompWeeks,
	bound,
	checkpointWeeks,
	clock,
	conditioningScale,
	liftWeek,
	longRunMinutes,
	lSitAccumulation,
	mainSets,
	mondayFamily,
	mondayGirl,
	pullUpSetReps,
	qualityB,
	sessionDate,
	supplementalSets,
	trainingMaxesFor,
	weekLayout
} from './evolution.ts';

const weeks = Array.from({ length: 17 }, (_, i) => i + 1);
const start = { trainingMaxes: { back_squat: 215, shoulder_press: 135, deadlift: 280 }, trainingMaxChanges: [] };
const sets = (week: number) => mainSets(liftWeek(week)).map((s) => [s.pct, s.reps, s.amrap]);

describe('calendar', () => {
	it('starts week n on Monday 2026-12-07 + 7(n − 1)', () => {
		expect(sessionDate('2026-12-07', 1, 'mon')).toBe('2026-12-07');
		expect(sessionDate('2026-12-07', 4, 'thu')).toBe('2026-12-31');
		expect(sessionDate('2026-12-07', 17, 'sat')).toBe('2027-04-03');
	});

	it('trains Mon–Sat, except the holiday weeks 3 and 4: no Friday, Friday on Thursday, Thursday on Wednesday', () => {
		expect(weekLayout(1).map((d) => `${d.day}:${d.slot}`)).toEqual([
			'mon:squat', 'tue:press', 'wed:qualityA', 'thu:easy', 'fri:friday', 'sat:longRun'
		]);
		for (const week of [3, 4]) {
			expect(weekLayout(week).map((d) => `${d.day}:${d.slot}`)).toEqual([
				'mon:squat', 'tue:press', 'wed:easy', 'thu:friday', 'sat:longRun'
			]);
		}
	});

	it('lays out the retest as in §A3, with the week 17 rest day on Friday', () => {
		expect(weekLayout(16).map((d) => `${d.day}:${d.slot}`)).toEqual([
			'mon:crossfitTotal', 'tue:submaxAndGymnastics', 'wed:run400Grace', 'thu:bike2Mile', 'fri:mileCindy', 'sat:cunningham'
		]);
		expect(weekLayout(17).map((d) => `${d.day}:${d.slot}`)).toEqual([
			'mon:run10k', 'tue:amanda', 'wed:row5k', 'thu:fran', 'sat:diane'
		]);
	});
});

describe('5/3/1 layout', () => {
	it('runs Leader 1–6, deload 7, Anchor 8–10, TM test 11, Anchor 12–14, deload 15, retest 16–17', () => {
		expect(weeks.map((w) => liftWeek(w).phase)).toEqual([
			...Array(6).fill('leader'), 'deload', 'anchor', 'anchor', 'anchor', 'tmTest',
			'anchor', 'anchor', 'anchor', 'deload', 'retest', 'retest'
		]);
	});

	it("Leader is 5's PRO with no AMRAP and FSL 5 × 5 at the first-set %, or 3 × 5 after a run", () => {
		expect(sets(1)).toEqual([[0.65, 5, false], [0.75, 5, false], [0.85, 5, false]]);
		expect(sets(6)).toEqual([[0.75, 5, false], [0.85, 5, false], [0.95, 5, false]]);
		expect(supplementalSets(liftWeek(2)).map((s) => [s.pct, s.reps])).toEqual(Array(5).fill([0.7, 5]));
		expect(supplementalSets(liftWeek(2), true)).toHaveLength(3);
	});

	it('Anchor is 5/3/1 with an AMRAP top set and FSL 3 × 5', () => {
		expect(sets(8)).toEqual([[0.65, 5, false], [0.75, 5, false], [0.85, 5, true]]);
		expect(sets(13)).toEqual([[0.7, 3, false], [0.8, 3, false], [0.9, 3, true]]);
		expect(sets(14)).toEqual([[0.75, 5, false], [0.85, 3, false], [0.95, 1, true]]);
		expect(supplementalSets(liftWeek(10)).map((s) => [s.pct, s.reps])).toEqual(Array(3).fill([0.75, 5]));
	});

	it('deloads at 40/50/60 × 5 with no FSL in weeks 7 and 15', () => {
		for (const week of [7, 15]) {
			expect(sets(week)).toEqual([[0.4, 5, false], [0.5, 5, false], [0.6, 5, false]]);
			expect(supplementalSets(liftWeek(week))).toEqual([]);
		}
	});

	it('tests the TM in week 11: 70/80/90 × 5, then 100% for 3+ and no FSL', () => {
		expect(sets(11)).toEqual([[0.7, 5, false], [0.8, 5, false], [0.9, 5, false], [1, 3, true]]);
		expect(supplementalSets(liftWeek(11))).toEqual([]);
	});
});

describe('training maxes', () => {
	it('follow the planned table when every step raises', () => {
		const at = (week: number) => Object.values(trainingMaxesFor(week, start));
		expect([1, 3, 4, 6, 7, 10, 11, 14, 15].map(at)).toEqual([
			[215, 135, 280], [215, 135, 280],
			[225, 140, 290], [225, 140, 290],
			[235, 145, 300], [235, 145, 300],
			[245, 150, 310], [245, 150, 310],
			[255, 155, 320]
		]);
	});

	it('hold when a cycle had a ground-out rep, and drop 10% after a failed TM test', () => {
		const gated = {
			...start,
			trainingMaxChanges: [
				{ week: 4 as const, lift: 'deadlift' as const, change: 'hold' as const },
				{ week: 12 as const, lift: 'back_squat' as const, change: 'cut' as const }
			]
		};
		expect(trainingMaxesFor(4, gated)).toEqual({ back_squat: 225, shoulder_press: 140, deadlift: 280 });
		expect(trainingMaxesFor(11, gated).back_squat).toBe(245);
		expect(trainingMaxesFor(12, gated)).toEqual({ back_squat: 220, shoulder_press: 150, deadlift: 300 });
		expect(trainingMaxesFor(15, gated).back_squat).toBe(230);
	});
});

describe('conditioning rotation', () => {
	it('cycles Monday couplet, phosphagen, glycolytic, Girl, with Grace, Fran and Diane in weeks 4, 8 and 12', () => {
		expect(weeks.slice(0, 15).map(mondayFamily)).toEqual([
			'couplet', 'phosphagen', 'glycolytic', 'girl',
			'couplet', 'phosphagen', 'glycolytic', 'girl',
			'couplet', 'phosphagen', 'glycolytic', 'girl',
			'couplet', 'phosphagen', 'glycolytic'
		]);
		expect([4, 8, 12].map(mondayGirl)).toEqual(['grace', 'fran', 'diane']);
		expect(mondayFamily(16)).toBeUndefined();
	});

	it('halves conditioning in weeks 1–2 and in weeks 7, 11 and 15', () => {
		expect(weeks.filter((w) => conditioningScale(w) === 0.5)).toEqual([1, 2, 7, 11, 15]);
	});

	it('gives odd-week bike intervals the pathway Monday did not use', () => {
		expect(weeks.map((w) => [w, bikeFamily(w)]).filter(([, f]) => f)).toEqual([
			[1, 'glycolytic'], [3, 'phosphagen'], [5, 'glycolytic'], [7, 'phosphagen'],
			[9, 'glycolytic'], [11, 'phosphagen'], [13, 'glycolytic'], [15, 'phosphagen']
		]);
	});

	it('runs Bombolini in weeks 2 and 10, the ladder in 6 and 14, and a mile TT in 4, 8 and 12', () => {
		expect(weeks.map((w) => [w, qualityB(w)]).filter(([, q]) => q)).toEqual([
			[2, 'bombolini'], [4, 'mileTimeTrial'], [6, 'ladder'], [8, 'mileTimeTrial'],
			[10, 'bombolini'], [12, 'mileTimeTrial'], [14, 'ladder']
		]);
	});
});

describe('long run', () => {
	it('starts at MIN(60, 1.1 × 10k), adds 5 min a week up to 90, and drops 20% in deload weeks', () => {
		expect(weeks.map((w) => longRunMinutes(w, 3193))).toEqual([
			58, 63, 68, 73, 78, 83, 66, 88, 90, 90, 90, 90, 90, 90, 72, undefined, undefined
		]);
		expect(longRunMinutes(1, 47 * 60 + 47)).toBe(52);
		expect(longRunMinutes(1, 60 * 60)).toBe(60);
	});
});

describe('gymnastics', () => {
	it('sets pull-ups at FLOOR(0.5 × latest strict max)', () => {
		expect([13, 14, 15, 20].map(pullUpSetReps)).toEqual([6, 7, 7, 10]);
	});

	it('accumulates 3 × max L-sit in sets of about 0.6 × max', () => {
		expect(lSitAccumulation(25)).toEqual({ rounds: 5, seconds: 15 });
		expect(lSitAccumulation(30)).toEqual({ rounds: 5, seconds: 18 });
	});
});

describe('checkpoints', () => {
	it('measures body comp monthly in weeks 1/5/9/13 and tests in weeks 4/8/12 (§G)', () => {
		expect(weeks.filter((w) => bodyCompWeeks.has(w))).toEqual([1, 5, 9, 13]);
		expect(weeks.filter((w) => checkpointWeeks.has(w))).toEqual([4, 8, 12]);
	});
});

describe('pace and HR bounds', () => {
	it('rounds in the named direction and never moves an exact value', () => {
		expect([bound(142.5, 'down'), bound(161.5, 'up'), bound(171, 'down')]).toEqual([142, 162, 171]);
		expect(bound(0.39216, 'up', 0.01)).toBeCloseTo(0.4);
		expect(bound(16.4, 'up', 0.1)).toBeCloseTo(16.4);
	});

	it('keeps tenths under a minute, so a "no faster than" 16.36 s reads 0:16.4, not 0:16', () => {
		expect(clock(16.355, 'up')).toBe('0:16.4');
		expect(clock(16.355, 'down')).toBe('0:16.3');
		expect(clock(37.94, 'up')).toBe('0:38.0');
		expect(clock(59.97, 'up')).toBe('1:00');
		expect(clock(528.84, 'up')).toBe('8:49');
		expect(clock(533.84, 'down')).toBe('8:53');
		expect(clock(92.16, 'up')).toBe('1:33');
	});
});
