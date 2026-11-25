import { describe, expect, it } from 'vitest';
import type { Manifest, Plant } from './manifest.ts';
import { catches, formatScore, normalizePath, parseFindings, scoreRun } from './score.ts';

const plant = (overrides: Partial<Plant>): Plant => ({
	classId: 'swallowed-error',
	split: 'held-out',
	status: 'planted',
	how: 'agent',
	behavior: 'sync.ts maps a 500 to synced',
	markers: ['syncOutbox'],
	cover: { title: 'refactor(log): tidy sync outcomes', claims: ['no behaviour change'] },
	files: ['src/lib/features/log/sync.ts'],
	hunks: [{ file: 'src/lib/features/log/sync.ts', start: 40, end: 44 }],
	diff: '',
	...overrides
});

const manifest: Manifest = {
	runId: 'r',
	baseSha: 'abc',
	createdAt: '2026-11-18T00:00:00.000Z',
	dryRun: false,
	plants: [
		plant({}),
		plant({
			classId: 'vacuous-assertion',
			split: 'tuning',
			markers: ['expectConverged'],
			files: ['src/lib/domain/score.spec.ts'],
			hunks: [{ file: 'src/lib/domain/score.spec.ts', start: 10, end: 10 }]
		}),
		plant({ classId: 'capped-generator', split: 'tuning', status: 'caught-by-machine', reason: 'pnpm proof:sync' })
	]
};

const verdict = (findings: unknown[]) => `VERIFIER: BENCH — FAIL\n\`\`\`json\n{"findings": []}\n\`\`\`\nfinal:\n\`\`\`json\n${JSON.stringify({ findings })}\n\`\`\`\n`;

describe('findings block', () => {
	it('reads the last valid json block', () => {
		expect(parseFindings(verdict([{ file: 'a.ts', line: 3, behavior: 'x' }]))).toEqual([{ file: 'a.ts', line: 3, behavior: 'x' }]);
	});

	it('returns null when the verdict has no findings block', () => {
		expect(parseFindings('VERIFIER: PASS, all good')).toBeNull();
		expect(parseFindings('```json\n{"nope": 1}\n```')).toBeNull();
	});

	it('normalises reported paths', () => {
		expect(normalizePath('`./src/a.ts:12`')).toEqual({ file: 'src/a.ts', line: 12 });
		expect(normalizePath('b/src/a.ts')).toEqual({ file: 'src/a.ts', line: null });
		expect(normalizePath('/tmp/clone/src/a.ts:3:9')).toEqual({ file: '/tmp/clone/src/a.ts', line: 3 });
	});
});

describe('a planted bug counts as caught only when the verdict names it', () => {
	const target = manifest.plants[0]!;

	it('file and a line inside the planted hunk', () => {
		expect(catches({ file: 'src/lib/features/log/sync.ts', line: 46, behavior: 'error dropped' }, target)).toBe(true);
	});

	it('absolute clone path with the line appended', () => {
		expect(catches({ file: '/x/clone/src/lib/features/log/sync.ts:41', behavior: 'error dropped' }, target)).toBe(true);
	});

	it('file with no line', () => {
		expect(catches({ file: 'src/lib/features/log/sync.ts', behavior: 'errors are swallowed' }, target)).toBe(true);
	});

	it('not the right file elsewhere in the file, unless it names the planted code', () => {
		expect(catches({ file: 'src/lib/features/log/sync.ts', line: 200, behavior: 'naming nit' }, target)).toBe(false);
		expect(catches({ file: 'src/lib/features/log/sync.ts', line: 200, behavior: 'syncOutbox reports synced on a 500' }, target)).toBe(true);
	});

	it('not a vague finding, and not another file', () => {
		expect(catches({ behavior: 'something is off with sync' }, target)).toBe(false);
		expect(catches({ file: 'src/lib/features/log/store.ts', line: 41, behavior: 'syncOutbox' }, target)).toBe(false);
	});

	it('a behaviour-only finding that names the planted function', () => {
		expect(catches({ behavior: 'syncOutbox turns a server error into success' }, target)).toBe(true);
	});

	it('ignores markers too short to be specific', () => {
		expect(catches({ behavior: 'the ok flag is wrong' }, plant({ markers: ['ok'] }))).toBe(false);
	});
});

describe('run score', () => {
	it('reports recall per split and keeps machine catches out of it', () => {
		const score = scoreRun(manifest, verdict([{ file: 'src/lib/features/log/sync.ts', line: 42, behavior: 'swallows errors' }, { behavior: 'unrelated gap' }]));
		expect(score.plants.map((p) => p.outcome)).toEqual(['caught', 'missed', 'caught-by-machine']);
		expect(score.recall).toEqual({ tuning: { caught: 0, planted: 1 }, 'held-out': { caught: 1, planted: 1 }, overall: { caught: 1, planted: 2 } });
		expect(score.otherFindings).toBe(1);
		const text = formatScore(score);
		expect(text).toContain('recall: tuning 0/1 (0%) · held-out 1/1 (100%) · overall 1/2 (50%)');
		expect(text).toContain('missed: vacuous-assertion');
		expect(text).toContain('caught by machine: capped-generator');
	});

	it('counts every plant as missed when the verdict cannot be parsed', () => {
		const score = scoreRun(manifest, 'VERIFIER: PASS');
		expect(score.verdictParsed).toBe(false);
		expect(score.recall.overall).toEqual({ caught: 0, planted: 2 });
		expect(formatScore(score)).toContain('no parseable findings block');
	});
});
