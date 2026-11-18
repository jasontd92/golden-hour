import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { evolutionWeeks } from '#lib/domain/evolution.ts';
import { freeTextInWorkBlocks, PlanWeek } from '#lib/domain/plan.ts';
import { planDir, weekFileName } from './plan-generate.ts';
import { report } from './repo-files.ts';

export function checkPlanFile(file: string): { problems: string[]; freeText: string[] } {
	const parsed = PlanWeek.safeParse(JSON.parse(readFileSync(file, 'utf8')));
	if (!parsed.success) {
		return {
			problems: parsed.error.issues.map((issue) => `${file}: ${issue.path.join('.')}: ${issue.message}`),
			freeText: []
		};
	}
	const week = parsed.data[0]?.week;
	const expected = week === undefined ? undefined : weekFileName(week);
	const problems = expected === path.basename(file) ? [] : [`${file}: holds week ${week}, so it should be named ${expected}`];
	const freeText = freeTextInWorkBlocks(parsed.data).map((use) => `${file}: ${use.date} ${use.block}: freeText "${use.text}"`);
	return { problems, freeText };
}

export function missingWeeks(names: string[]): string[] {
	return Array.from({ length: evolutionWeeks }, (_, i) => weekFileName(i + 1))
		.filter((name) => !names.includes(name))
		.map((name) => `${planDir}/${name}: missing`);
}

if (import.meta.main) {
	const names = readdirSync(planDir).filter((name) => name.startsWith('week-'));
	const results = names.map((name) => checkPlanFile(path.join(planDir, name)));
	for (const line of results.flatMap((r) => r.freeText)) console.log(line);
	report(
		[...missingWeeks(names), ...results.flatMap((r) => r.problems)],
		`plan:check: ${names.length} of ${evolutionWeeks} plan weeks valid`
	);
}
