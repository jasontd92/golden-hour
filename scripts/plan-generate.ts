import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PlanInputs } from '#lib/domain/evolution.ts';
import { PlanWeek } from '#lib/domain/plan.ts';
import { generatePlan } from './plan-sessions.ts';

export const planDir = 'plan';
export const inputsFile = path.join(planDir, 'inputs.json');
export const weekFileName = (week: number) => `week-${String(week).padStart(2, '0')}.json`;

export const readInputs = (file = inputsFile) => PlanInputs.parse(JSON.parse(readFileSync(file, 'utf8')));

const isLeaf = (value: unknown) => typeof value !== 'object' || value === null;

export function compactJson(value: unknown, indent = ''): string {
	if (isLeaf(value)) return JSON.stringify(value);
	const inner = `${indent}\t`;
	if (Array.isArray(value)) {
		return value.length === 0 ? '[]' : `[\n${value.map((v) => inner + compactJson(v, inner)).join(',\n')}\n${indent}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.every(([, v]) => isLeaf(v))) {
		return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
	}
	return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${compactJson(v, inner)}`).join(',\n')}\n${indent}}`;
}

export function renderPlan(inputs: PlanInputs): Record<string, string> {
	return Object.fromEntries(
		generatePlan(inputs).map((sessions, i) => [weekFileName(i + 1), `${compactJson(PlanWeek.parse(sessions))}\n`])
	);
}

if (import.meta.main) {
	const files = renderPlan(readInputs());
	mkdirSync(planDir, { recursive: true });
	for (const name of readdirSync(planDir).filter((n) => n.startsWith('week-'))) rmSync(path.join(planDir, name));
	for (const [name, content] of Object.entries(files)) writeFileSync(path.join(planDir, name), content);
	console.log(`plan:generate: wrote ${Object.keys(files).length} weeks to ${planDir}/`);
}
