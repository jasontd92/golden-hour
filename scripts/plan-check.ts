import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { freeTextInWorkBlocks, PlanWeek } from '#lib/domain/plan.ts';
import { report } from './repo-files.ts';

export const planDir = 'fixtures/plan';

export function checkPlanFile(file: string): { problems: string[]; freeText: string[] } {
	const parsed = PlanWeek.safeParse(JSON.parse(readFileSync(file, 'utf8')));
	if (!parsed.success) {
		return {
			problems: parsed.error.issues.map((issue) => `${file}: ${issue.path.join('.')}: ${issue.message}`),
			freeText: []
		};
	}
	const freeText = freeTextInWorkBlocks(parsed.data).map((use) => `${file}: ${use.date} ${use.block}: freeText "${use.text}"`);
	return { problems: [], freeText };
}

if (import.meta.main) {
	const files = readdirSync(planDir)
		.filter((name) => name.endsWith('.json'))
		.map((name) => path.join(planDir, name));
	const results = files.map(checkPlanFile);
	for (const line of results.flatMap((r) => r.freeText)) console.log(line);
	report(
		results.flatMap((r) => r.problems),
		`plan:check: ${files.length} plan files valid`
	);
}
