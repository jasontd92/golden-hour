import { z } from 'zod';
import { PlanWeek, type PlanSession } from '#lib/domain/plan.ts';
import { planSessions } from '#lib/domain/schedule.ts';

const planFiles = import.meta.glob<unknown>('/plan/week-*.json', { eager: true, import: 'default' });

export function loadPlan(files: Record<string, unknown> = planFiles): PlanSession[] {
	const weeks = Object.entries(files).map(([file, json]) => {
		const parsed = PlanWeek.safeParse(json);
		if (!parsed.success) throw new Error(`${file}: ${z.prettifyError(parsed.error)}`);
		return parsed.data;
	});
	return planSessions(weeks);
}
