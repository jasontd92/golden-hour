import { addDays, mondayOf } from './calendar.ts';
import type { PlanSession, PlanWeek } from './plan.ts';

export type TodayPick =
	| { kind: 'session'; session: PlanSession; beforePlan: boolean }
	| { kind: 'rest'; date: string };

export interface WeekDay {
	date: string;
	session: PlanSession | undefined;
}

export interface WeekView {
	week: number;
	days: WeekDay[];
}

export function planSessions(weeks: readonly PlanWeek[]): PlanSession[] {
	const sessions = weeks.flat().toSorted((a, b) => a.date.localeCompare(b.date));
	const repeated = sessions.find((s, i) => s.date === sessions[i - 1]?.date);
	if (repeated) throw new Error(`plan has two sessions on ${repeated.date}`);
	return sessions;
}

export function pickToday(plan: readonly PlanSession[], today: string): TodayPick {
	const first = plan[0];
	if (first && today < first.date) return { kind: 'session', session: first, beforePlan: true };
	const session = plan.find((s) => s.date === today);
	return session ? { kind: 'session', session, beforePlan: false } : { kind: 'rest', date: today };
}

export function focusDate(pick: TodayPick): string {
	return pick.kind === 'session' ? pick.session.date : pick.date;
}

export function weekView(plan: readonly PlanSession[], date: string): WeekView | undefined {
	const first = plan[0];
	const last = plan.at(-1);
	if (!first || !last) return undefined;
	const clamped = date < first.date ? first.date : date > last.date ? last.date : date;
	const monday = mondayOf(clamped);
	const days = Array.from({ length: 7 }, (_, i) => {
		const day = addDays(monday, i);
		return { date: day, session: plan.find((s) => s.date === day) };
	});
	const week = days.find((d) => d.session)?.session?.week ?? plan.findLast((s) => s.date <= clamped)?.week ?? first.week;
	return { week, days };
}
