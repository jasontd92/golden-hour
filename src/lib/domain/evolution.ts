import { z } from 'zod';
import { addDays } from './calendar.ts';
import type { PercentSet } from './plan.ts';
import { floorToPlate } from './strength.ts';

export const mainLifts = ['back_squat', 'shoulder_press', 'deadlift'] as const;
export const MainLift = z.enum(mainLifts);
export type MainLift = z.infer<typeof MainLift>;
export type TrainingMaxes = Record<MainLift, number>;

const Measured = z.strictObject({
	value: z.number().positive(),
	date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
	provisional: z.boolean()
});
export type Measured = z.infer<typeof Measured>;

export const trainingMaxStepWeeks = [4, 7, 11, 12, 15] as const;
export const TrainingMaxChange = z.enum(['raise', 'hold', 'cut']);
export type TrainingMaxChange = z.infer<typeof TrainingMaxChange>;

const lb = z.number().positive();

export const PlanInputs = z.strictObject({
	firstMonday: z.iso.date(),
	trainingMaxes: z.strictObject({ back_squat: lb, shoulder_press: lb, deadlift: lb }),
	trainingMaxChanges: z.array(
		z.strictObject({ week: z.literal(trainingMaxStepWeeks), lift: MainLift, change: TrainingMaxChange })
	),
	submaxPaceSecondsPerMile: z.number().positive(),
	tests: z.strictObject({
		run10kSeconds: Measured,
		mileSeconds: Measured.nullable(),
		run400Seconds: Measured,
		bike2MileSeconds: Measured,
		strictPullUps: Measured,
		lSitSeconds: Measured,
		ringDips: Measured.nullable(),
		hrMax: Measured.nullable()
	})
});
export type PlanInputs = z.infer<typeof PlanInputs>;

export const evolutionWeeks = 17;
export const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof weekdays)[number];

export const sessionDate = (firstMonday: string, week: number, day: Weekday) =>
	addDays(firstMonday, 7 * (week - 1) + weekdays.indexOf(day));

export const holidayWeeks: ReadonlySet<number> = new Set([3, 4]);
export const retestWeeks: ReadonlySet<number> = new Set([16, 17]);
export const isBWeek = (week: number) => week % 2 === 0;

export type TrainingSlot = 'squat' | 'press' | 'qualityA' | 'easy' | 'friday' | 'longRun';
export type RetestSlot =
	| 'crossfitTotal'
	| 'submaxAndGymnastics'
	| 'run400Grace'
	| 'bike2Mile'
	| 'mileCindy'
	| 'cunningham'
	| 'run10k'
	| 'amanda'
	| 'row5k'
	| 'fran'
	| 'diane';
export type Slot = TrainingSlot | RetestSlot;

export interface DaySlot {
	day: Weekday;
	slot: Slot;
}

const retestLayout: Record<16 | 17, Partial<Record<Weekday, RetestSlot>>> = {
	16: {
		mon: 'crossfitTotal',
		tue: 'submaxAndGymnastics',
		wed: 'run400Grace',
		thu: 'bike2Mile',
		fri: 'mileCindy',
		sat: 'cunningham'
	},
	17: { mon: 'run10k', tue: 'amanda', wed: 'row5k', thu: 'fran', sat: 'diane' }
};

const normalWeek: Record<Weekday, TrainingSlot> = {
	mon: 'squat',
	tue: 'press',
	wed: 'qualityA',
	thu: 'easy',
	fri: 'friday',
	sat: 'longRun'
};

// why: the holiday falls on Friday, so Friday's session moves to Thursday, Thursday's easy day to Wednesday, and Quality A is skipped.
const holidayWeek: Partial<Record<Weekday, TrainingSlot>> = {
	mon: 'squat',
	tue: 'press',
	wed: 'easy',
	thu: 'friday',
	sat: 'longRun'
};

export function weekLayout(week: number): DaySlot[] {
	const layout =
		week === 16 || week === 17 ? retestLayout[week] : holidayWeeks.has(week) ? holidayWeek : normalWeek;
	return weekdays.flatMap((day) => {
		const slot = layout[day];
		return slot ? [{ day, slot }] : [];
	});
}

export type LiftWeek =
	| { phase: 'leader' | 'anchor'; cycleWeek: 1 | 2 | 3 }
	| { phase: 'deload' | 'tmTest' | 'retest' };

const cycleWeekOf = (week: number) => (((week - 1) % 3) + 1) as 1 | 2 | 3;

export function liftWeek(week: number): LiftWeek {
	if (week <= 6) return { phase: 'leader', cycleWeek: cycleWeekOf(week) };
	if (week === 7 || week === 15) return { phase: 'deload' };
	if (week === 11) return { phase: 'tmTest' };
	if (week >= 16) return { phase: 'retest' };
	return { phase: 'anchor', cycleWeek: cycleWeekOf(week <= 10 ? week - 7 : week - 11) };
}

const cyclePcts: Record<1 | 2 | 3, [number, number, number]> = {
	1: [0.65, 0.75, 0.85],
	2: [0.7, 0.8, 0.9],
	3: [0.75, 0.85, 0.95]
};
const anchorReps: Record<1 | 2 | 3, [number, number, number]> = { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1] };

const set = (pct: number, reps: number, amrap = false): PercentSet => ({ pct, reps, amrap });

export function mainSets(lift: LiftWeek): PercentSet[] {
	switch (lift.phase) {
		case 'leader':
			return cyclePcts[lift.cycleWeek].map((pct) => set(pct, 5));
		case 'anchor': {
			const reps = anchorReps[lift.cycleWeek];
			return cyclePcts[lift.cycleWeek].map((pct, i) => set(pct, reps[i] ?? 5, i === 2));
		}
		case 'deload':
			return [0.4, 0.5, 0.6].map((pct) => set(pct, 5));
		case 'tmTest':
			return [set(0.7, 5), set(0.8, 5), set(0.9, 5), set(1, 3, true)];
		case 'retest':
			return [];
	}
}

export function supplementalSets(lift: LiftWeek, afterRun = false): PercentSet[] {
	if (lift.phase !== 'leader' && lift.phase !== 'anchor') return [];
	const count = lift.phase === 'anchor' || afterRun ? 3 : 5;
	return Array.from({ length: count }, () => set(cyclePcts[lift.cycleWeek][0], 5));
}

const increment: TrainingMaxes = { back_squat: 10, shoulder_press: 5, deadlift: 10 };
const plannedChange = (week: number): TrainingMaxChange => (week === 12 ? 'hold' : 'raise');

export function trainingMaxesFor(week: number, inputs: Pick<PlanInputs, 'trainingMaxes' | 'trainingMaxChanges'>): TrainingMaxes {
	const tms = { ...inputs.trainingMaxes };
	for (const step of trainingMaxStepWeeks.filter((w) => w <= week)) {
		for (const lift of mainLifts) {
			const change =
				inputs.trainingMaxChanges.find((c) => c.week === step && c.lift === lift)?.change ?? plannedChange(step);
			if (change === 'raise') tms[lift] += increment[lift];
			if (change === 'cut') tms[lift] = floorToPlate(tms[lift] * 0.9);
		}
	}
	return tms;
}

export type MondayFamily = 'couplet' | 'phosphagen' | 'glycolytic' | 'girl';
const familyCycle: MondayFamily[] = ['couplet', 'phosphagen', 'glycolytic', 'girl'];

export function mondayFamily(week: number): MondayFamily | undefined {
	return retestWeeks.has(week) ? undefined : familyCycle[(week - 1) % 4];
}

export const familyOccurrence = (week: number) => Math.floor((week - 1) / 4);

export type Girl = 'grace' | 'fran' | 'diane';
const girls: Partial<Record<number, Girl>> = { 4: 'grace', 8: 'fran', 12: 'diane' };
export const mondayGirl = (week: number): Girl | undefined => girls[week];

export type BikeFamily = 'phosphagen' | 'glycolytic';

export function bikeFamily(week: number): BikeFamily | undefined {
	if (isBWeek(week) || retestWeeks.has(week)) return undefined;
	return mondayFamily(week) === 'glycolytic' ? 'phosphagen' : 'glycolytic';
}

export type QualityB = 'bombolini' | 'ladder' | 'mileTimeTrial';
const qualityBs: Partial<Record<number, QualityB>> = {
	2: 'bombolini',
	4: 'mileTimeTrial',
	6: 'ladder',
	8: 'mileTimeTrial',
	10: 'bombolini',
	12: 'mileTimeTrial',
	14: 'ladder'
};
export const qualityB = (week: number): QualityB | undefined => qualityBs[week];

const scaledWeeks: ReadonlySet<number> = new Set([1, 2, 7, 11, 15]);
export const conditioningScale = (week: number) => (scaledWeeks.has(week) ? 0.5 : 1);
export const scaleRounds = (rounds: number, week: number) => Math.ceil(rounds * conditioningScale(week));

export const checkpointWeeks: ReadonlySet<number> = new Set([4, 8, 12]);
export const deloadWeeks: ReadonlySet<number> = new Set([7, 15]);

export const longRunCapMinutes = 90;

export function longRunMinutes(week: number, run10kSeconds: number): number | undefined {
	if (week < 1 || retestWeeks.has(week)) return undefined;
	let progression = Math.min(60, Math.floor((1.1 * run10kSeconds) / 60));
	let minutes = progression;
	for (let w = 2; w <= week; w++) {
		if (deloadWeeks.has(w)) {
			minutes = Math.round(0.8 * progression);
		} else {
			progression = Math.min(longRunCapMinutes, progression + 5);
			minutes = progression;
		}
	}
	return minutes;
}

export const baseWeekRunMinutes = 135;
export const fullWeek = (week: number) => !holidayWeeks.has(week) && !deloadWeeks.has(week) && !retestWeeks.has(week);
export const weeklyRunCap = (lastFullWeekMinutes: number) => Math.floor(1.1 * lastFullWeekMinutes);
export const easyRunRange = { min: 25, max: 35 } as const;

export const pullUpSetReps = (strictMax: number) => Math.floor(0.5 * strictMax);

export function lSitAccumulation(maxSeconds: number): { rounds: number; seconds: number } {
	const seconds = Math.round(0.6 * maxSeconds);
	return { rounds: Math.ceil((3 * maxSeconds) / seconds), seconds };
}

export const secondsPerMile10k = (run10kSeconds: number) => run10kSeconds / 6.214;
export const bikeSecondsPerMile = (bike2MileSeconds: number) => bike2MileSeconds / 2;

export function clock(seconds: number): string {
	const whole = Math.round(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
