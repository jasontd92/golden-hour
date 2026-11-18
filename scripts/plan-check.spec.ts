import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPlanFile, missingWeeks } from './plan-check.ts';

const writePlan = (sessions: unknown, name = 'week-01.json') => {
	const file = path.join(mkdtempSync(path.join(tmpdir(), 'plan-check-')), name);
	writeFileSync(file, JSON.stringify(sessions));
	return file;
};
const [monday] = JSON.parse(readFileSync('plan/week-01.json', 'utf8')) as Record<string, unknown>[];

describe('checkPlanFile', () => {
	it('passes the committed week 1 with nothing flagged', () => {
		expect(checkPlanFile('plan/week-01.json')).toStrictEqual({ problems: [], freeText: [] });
	});

	it('names the path of each schema problem', () => {
		const { problems } = checkPlanFile(writePlan([{ ...monday, week: 18 }]));
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/week-01\.json: 0\.week: /);
	});

	it('flags a file named for a different week', () => {
		expect(checkPlanFile(writePlan([monday], 'week-02.json')).problems).toStrictEqual([
			expect.stringMatching(/week-02\.json: holds week 1, so it should be named week-01\.json$/)
		]);
	});

	it('flags freeText in a work block', () => {
		const blocks = [{ name: 'Metcon', kind: 'metcon', minutes: 10, hard: true, prescriptions: [{ kind: 'freeText', text: 'Something hard' }] }];
		const { freeText } = checkPlanFile(writePlan([{ ...monday, blocks }]));
		expect(freeText).toStrictEqual([expect.stringMatching(/2026-12-07 Metcon: freeText "Something hard"$/)]);
	});
});

describe('missingWeeks', () => {
	it('names every week of the evolution that has no file', () => {
		const names = Array.from({ length: 17 }, (_, i) => `week-${String(i + 1).padStart(2, '0')}.json`);
		expect(missingWeeks(names)).toStrictEqual([]);
		expect(missingWeeks(names.filter((n) => n !== 'week-09.json' && n !== 'week-17.json'))).toStrictEqual([
			'plan/week-09.json: missing',
			'plan/week-17.json: missing'
		]);
	});
});
