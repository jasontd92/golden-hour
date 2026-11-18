import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPlanFile } from './plan-check.ts';

const writePlan = (sessions: unknown) => {
	const file = path.join(mkdtempSync(path.join(tmpdir(), 'plan-check-')), 'week.json');
	writeFileSync(file, JSON.stringify(sessions));
	return file;
};
const [monday] = JSON.parse(readFileSync('fixtures/plan/week-01.json', 'utf8')) as Record<string, unknown>[];

describe('checkPlanFile', () => {
	it('passes the committed fixture with nothing flagged', () => {
		expect(checkPlanFile('fixtures/plan/week-01.json')).toStrictEqual({ problems: [], freeText: [] });
	});

	it('names the path of each schema problem', () => {
		const { problems } = checkPlanFile(writePlan([{ ...monday, week: 18 }]));
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/week\.json: 0\.week: /);
	});

	it('flags freeText in a work block', () => {
		const blocks = [{ name: 'Metcon', kind: 'metcon', minutes: 10, hard: true, prescriptions: [{ kind: 'freeText', text: 'Something hard' }] }];
		const { freeText } = checkPlanFile(writePlan([{ ...monday, blocks }]));
		expect(freeText).toStrictEqual([expect.stringMatching(/2026-12-07 Metcon: freeText "Something hard"$/)]);
	});
});
