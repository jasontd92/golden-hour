import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LiftEvidence, Result, Workout } from '#lib/domain/history.ts';
import { LogEntry } from '#lib/domain/log.ts';
import { PlanSession, PlanWeek } from '#lib/domain/plan.ts';

export const emittedSchemas: Record<string, z.ZodType> = {
	'plan-session': PlanSession,
	'plan-week': PlanWeek,
	'log-entry': LogEntry,
	workout: Workout,
	result: Result,
	'lift-evidence': LiftEvidence
};

export const schemasDir = 'schemas';

export function renderSchema(name: string, schema: z.ZodType): string {
	const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'throw' });
	return `${JSON.stringify({ $id: `golden-hour/${name}.json`, ...json }, null, '\t')}\n`;
}

if (import.meta.main) {
	mkdirSync(schemasDir, { recursive: true });
	for (const [name, schema] of Object.entries(emittedSchemas)) {
		writeFileSync(path.join(schemasDir, `${name}.json`), renderSchema(name, schema));
	}
	console.log(`schema:emit: wrote ${Object.keys(emittedSchemas).length} schemas to ${schemasDir}/`);
}
