import { addDays, holidayName, mondayOf } from './calendar.ts';
import {
	checkpointWeeks,
	conditioningScale,
	liftWeek,
	mainLifts,
	mondayGirl,
	qualityB,
	weekLayout,
	weekdays,
	type LiftWeek,
	type MainLift,
	type Slot
} from './evolution.ts';
import { isHardSession, type PlanSession } from './plan.ts';

export interface GridDay {
	date: string;
	session: PlanSession | undefined;
	hard: boolean;
	scaled: boolean;
	test: string | undefined;
	moved: string | undefined;
	holiday: string | undefined;
}

export interface GridWeek {
	week: number;
	monday: string;
	phase: string;
	firstOfPhase: boolean;
	days: GridDay[];
}

const phaseNames: Record<LiftWeek['phase'], string> = {
	leader: 'Leader',
	anchor: 'Anchor',
	deload: 'Deload',
	tmTest: 'TM test',
	retest: 'Retest'
};

export const phaseName = (week: number) => phaseNames[liftWeek(week).phase];

const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

export function sessionSlot(session: PlanSession): Slot | undefined {
	const day = weekdays[weekdayIndex(session.date)];
	return weekLayout(session.week).find((d) => d.day === day)?.slot;
}

interface Test {
	label: string;
	benchmarks: readonly string[];
	lifts: readonly string[];
}

const test = (label: string, benchmarks: readonly string[] = [], lifts: readonly string[] = []): Test => ({
	label,
	benchmarks,
	lifts
});

const retestTests: Partial<Record<Slot, Test>> = {
	crossfitTotal: test('CFT', ['crossfit-total', 'strict-pullups-max'], ['back-squat', 'shoulder-press', 'deadlift']),
	submaxAndGymnastics: test('Submax', ['max-l-sit']),
	run400Grace: test('400 m, Grace', ['run-400m', 'grace']),
	bike2Mile: test('Bike 2 mi', ['assault-bike-2mi']),
	mileCindy: test('Mile, Cindy', ['cindy']),
	cunningham: test('Cunningham', ['jason-cunningham']),
	run10k: test('10k', ['run-10k']),
	amanda: test('Amanda', ['amanda']),
	row5k: test('Row 5k', ['row-5k']),
	fran: test('Fran', ['fran']),
	diane: test('Diane', ['diane'])
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function sessionTest(session: PlanSession): Test | undefined {
	const slot = sessionSlot(session);
	const week = session.week;
	if (!slot) return undefined;
	const retest = retestTests[slot];
	if (retest) return retest;
	const girl = mondayGirl(week);
	if (slot === 'squat' && girl) return test(capitalize(girl), [girl]);
	if (slot === 'press' && checkpointWeeks.has(week)) return test('Submax');
	if (slot === 'friday' && qualityB(week) === 'mileTimeTrial') return test('Mile TT');
	return undefined;
}

export const testLabel = (session: PlanSession) => sessionTest(session)?.label;

export function attemptDates(plan: readonly PlanSession[], kind: 'benchmark' | 'lift', id: string): PlanSession[] {
	return plan.filter((session) => {
		const found = sessionTest(session);
		if (kind === 'benchmark' && id === 'strict-pullups-max' && sessionSlot(session) === 'easy') return true;
		return (kind === 'benchmark' ? found?.benchmarks : found?.lifts)?.includes(id) === true;
	});
}

export function nextAttempt(
	plan: readonly PlanSession[],
	kind: 'benchmark' | 'lift',
	id: string,
	today: string
): number | undefined {
	return attemptDates(plan, kind, id).find((s) => s.date >= today)?.week;
}

const isScaled = (session: PlanSession) => isHardSession(session) && conditioningScale(session.week) < 1;

export function planGrid(plan: readonly PlanSession[]): GridWeek[] {
	const weeks = [...new Set(plan.map((s) => s.week))].toSorted((a, b) => a - b);
	const columns = columnNames(plan).map((name) => name.toLowerCase());
	return weeks.map((week, i) => {
		const sessions = plan.filter((s) => s.week === week);
		const monday = mondayOf(sessions[0]?.date ?? '');
		const phase = phaseName(week);
		const previous = weeks[i - 1];
		const days = weekdays.map((_, d) => {
			const date = addDays(monday, d);
			const session = sessions.find((s) => s.date === date);
			const usual = session?.title.toLowerCase().includes(columns[d] ?? '') ?? true;
			return {
				date,
				session,
				hard: session ? isHardSession(session) : false,
				scaled: session ? isScaled(session) : false,
				test: session ? testLabel(session) : undefined,
				moved: usual ? undefined : session?.title,
				holiday: holidayName(date)
			};
		});
		return { week, monday, phase, firstOfPhase: previous === undefined || phaseName(previous) !== phase, days };
	});
}

export function columnNames(plan: readonly PlanSession[]): string[] {
	return weekdays.map((_, d) => {
		const counts = new Map<string, number>();
		for (const session of plan.filter((s) => weekdayIndex(s.date) === d)) {
			for (const part of new Set(session.title.split(' + ').map((p) => p.toLowerCase()))) {
				counts.set(part, (counts.get(part) ?? 0) + 1);
			}
		}
		let top = '';
		let most = 0;
		for (const [part, count] of counts) {
			if (count > most) [top, most] = [part, count];
		}
		return capitalize(top);
	});
}

export interface TrainingMax {
	lift: MainLift;
	value: number;
}

export interface WeekSummary {
	week: number;
	phase: string;
	monday: string;
	sunday: string;
	scheme: string | undefined;
	trainingMaxes: TrainingMax[];
	longRunMinutes: number | undefined;
	tests: number;
	planned: number;
}

function percentSets(sessions: readonly PlanSession[]) {
	return sessions.flatMap((s) =>
		s.blocks.flatMap((b) => b.prescriptions.flatMap((p) => (p.kind === 'percentSets' ? [p] : [])))
	);
}

function schemeLabel(sessions: readonly PlanSession[]): string | undefined {
	const main = percentSets(sessions)[0];
	if (!main) return undefined;
	const pcts = main.sets.map((s) => Math.round(s.pct * 100)).join('/');
	const reps = main.sets.map((s) => s.reps);
	const sameReps = reps.every((r) => r === reps[0]);
	const amrap = main.sets.at(-1)?.amrap ? '+' : '';
	return `${pcts}% × ${sameReps ? String(reps[0]) : reps.join('/')}${amrap}`;
}

export function weekSummary(plan: readonly PlanSession[], week: number): WeekSummary | undefined {
	const sessions = plan.filter((s) => s.week === week);
	const first = sessions[0];
	if (!first) return undefined;
	const monday = mondayOf(first.date);
	const sets = percentSets(sessions);
	const trainingMaxes = mainLifts.flatMap((lift) => {
		const found = sets.find((p) => p.lift === lift);
		return found ? [{ lift, value: found.trainingMax }] : [];
	});
	const longRun = sessions.find((s) => sessionSlot(s) === 'longRun');
	const runMinutes = longRun?.blocks.filter((b) => b.kind === 'conditioning').map((b) => b.minutes) ?? [];
	return {
		week,
		phase: phaseName(week),
		monday,
		sunday: addDays(monday, 6),
		scheme: schemeLabel(sessions),
		trainingMaxes,
		longRunMinutes: runMinutes.length > 0 ? Math.max(...runMinutes) : undefined,
		tests: sessions.filter((s) => testLabel(s) !== undefined).length,
		planned: sessions.length
	};
}

export function trainingMaxByWeek(plan: readonly PlanSession[], lift: string): { week: number; value: number }[] {
	const weeks = [...new Set(plan.map((s) => s.week))].toSorted((a, b) => a - b);
	return weeks.flatMap((week) => {
		const found = percentSets(plan.filter((s) => s.week === week)).find((p) => p.lift === lift);
		return found ? [{ week, value: found.trainingMax }] : [];
	});
}

export function loggedDates(records: readonly { sessionDate: string }[]): Set<string> {
	return new Set(records.map((r) => r.sessionDate));
}
