import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type Commit, provenanceProblems } from './provenance.ts';

// why: captured from this repo's history (sha, parent count, full message, files changed against the first parent); CI on main clones at depth 1, so the tests can't read history live
const history = JSON.parse(readFileSync(new URL('./fixtures/oracle/commits.json', import.meta.url), 'utf8')) as Commit[];
const real = (prefix: string) => history.find(({ sha }) => sha.startsWith(prefix))!;
const trailer = 'Verified-by: oracle';
const commit = (over: Partial<Commit>): Commit => ({ sha: 'a'.repeat(40), parents: 1, message: 'feat: x\n', files: [], ...over });
const mentions = (problems: string[], sha: string, file: string) => problems.filter((line) => line.includes(sha.slice(0, 7)) && line.includes(file));

describe('provenanceProblems on real history', () => {
	const range = ['715de4c', '91fe627', '46ed249', '8ea54ee'].map(real);

	it('finds exactly the 4 known violations in origin/main..origin/ws12-stryker, one per (commit, test file); rules out one problem per commit, or per file', () => {
		const problems = provenanceProblems(range);
		expect(problems).toHaveLength(4);
		for (const [sha, file] of [
			['715de4c', 'lint/rules/no-prose-comments.spec.ts'],
			['715de4c', 'scripts/mutation-scope.spec.ts'],
			['91fe627', 'scripts/mutation-scope.spec.ts'],
			['46ed249', 'scripts/mutation-scope.spec.ts']
		] as const) expect(mentions(problems, sha, file)).toHaveLength(1);
	});

	it('counts a deleted test (46ed249 removes scripts/mutation-scope.spec.ts) as changing it; rules out checking only added or modified files', () => {
		expect(provenanceProblems([real('46ed249')])).toHaveLength(1);
	});

	it('exempts merge commits even when they bring in test files (8ea54ee, bd58a69 carry six specs from main); rules out treating merges like ordinary commits', () => {
		for (const merge of [real('8ea54ee'), real('bd58a69')]) {
			expect(merge.parents).toBe(2);
			expect(merge.files.some((file) => file.endsWith('.spec.ts'))).toBe(true);
			expect(provenanceProblems([merge])).toEqual([]);
		}
	});

	it('does not accept the trailer text quoted mid-line: 8b1b6ff mentions "a Verified-by: oracle trailer" in its body; rules out a substring match', () => {
		const quoted = real('8b1b6ff');
		expect(quoted.message).toContain(trailer);
		expect(provenanceProblems([quoted])).toEqual([]);
		expect(provenanceProblems([{ ...quoted, files: [...quoted.files, 'scripts/provenance.spec.ts'] }])).toHaveLength(1);
	});

	it('passes the commits on this branch that touch no tests (8b1b6ff, 5b31962)', () => {
		expect(provenanceProblems([real('8b1b6ff'), real('5b31962')])).toEqual([]);
	});
});

describe('provenanceProblems: which paths are tests', () => {
	it.each(['src/lib/plan.spec.ts', 'scripts/canary.spec.ts', 'e2e/today.e2e.ts', 'verification.yaml', 'root.spec.ts', 'lint/rules/deep/nested/x.spec.ts'])(
		'flags %s without the trailer; rules out a pattern that misses a test kind or depth',
		(file) => {
			expect(provenanceProblems([commit({ files: [file] })])).toHaveLength(1);
		}
	);

	it.each(['scripts/canary.local.spec.ts', 'src/lib/x.local.spec.ts', 'src/lib/plan.ts', 'scripts/spec.ts.md', 'README.md', 'e2e/helpers.ts', 'verification/ledger/27.json'])(
		'ignores %s; rules out flagging the implementer\'s own *.local.spec.ts checks or non-test files',
		(file) => {
			expect(provenanceProblems([commit({ files: [file] })])).toEqual([]);
		}
	);
});

describe('provenanceProblems: the trailer', () => {
	const tests = ['scripts/a.spec.ts'];

	it('accepts the exact trailer line at the end of the message, or among other trailers', () => {
		expect(provenanceProblems([commit({ files: tests, message: `test: a\n\n${trailer}\n` })])).toEqual([]);
		expect(provenanceProblems([commit({ files: tests, message: `test: a\n\nbody\n\nRefs: #37\n${trailer}\nSigned-off-by: X <x@y.z>\n` })])).toEqual([]);
	});

	it.each([
		['no trailer', 'test: a\n'],
		['lowercase key', 'test: a\n\nverified-by: oracle\n'],
		['other verifier', 'test: a\n\nVerified-by: implementer\n'],
		['longer value', 'test: a\n\nVerified-by: oracles\n'],
		['negated', 'test: a\n\nNot Verified-by: oracle\n'],
		['in the subject sentence', 'test: still needs a Verified-by: oracle pass\n'],
		['no space', 'test: a\n\nVerified-by:oracle\n']
	])('rejects %s; rules out a loose or case-insensitive match', (_, message) => {
		expect(provenanceProblems([commit({ files: tests, message })])).toHaveLength(1);
	});

	it('judges each commit on its own trailer: an oracle commit does not cover a later implementer commit; rules out "any commit in the range has the trailer"', () => {
		const problems = provenanceProblems([
			commit({ sha: '1'.repeat(40), files: tests, message: `test: a\n\n${trailer}\n` }),
			commit({ sha: '2'.repeat(40), files: tests, message: 'fix: weaken a\n' })
		]);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('2222222');
	});

	it('exempts a merge with any number of parents ≥ 2 but not a root commit (0 parents)', () => {
		expect(provenanceProblems([commit({ parents: 3, files: tests })])).toEqual([]);
		expect(provenanceProblems([commit({ parents: 0, files: tests })])).toHaveLength(1);
	});
});

describe('provenance CLI', () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'provenance-'));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));
	const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' }).trim();
	const write = (file: string, text = 'x\n') => {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), text);
	};
	const commitAll = (message: string) => {
		git('add', '-A', '-f');
		git('commit', '-q', '--allow-empty', '-m', message);
		return git('rev-parse', 'HEAD');
	};
	const cli = (range: string) => spawnSync('node', [path.resolve('scripts/provenance.ts'), range], { cwd: dir, encoding: 'utf8' });

	git('init', '-q', '-b', 'main');
	write('src/a.ts');
	commitAll('init');
	git('checkout', '-q', '-b', 'pr');
	const base = git('rev-parse', 'main');
	write('src/b.ts');
	const clean = commitAll('feat: b');
	write('scripts/b.spec.ts');
	const implementerTest = commitAll(real('8b1b6ff').message);
	write('e2e/b.e2e.ts');
	commitAll(`test: b e2e\n\n${trailer}\n`);
	write('scripts/b.local.spec.ts');
	commitAll('chore: my own check');
	git('checkout', '-q', 'main');
	write('scripts/main.spec.ts');
	commitAll('test: landed on main through its own PR');
	git('checkout', '-q', 'pr');
	git('merge', '-q', '--no-ff', '--no-edit', 'main');
	rmSync(path.join(dir, 'scripts/b.spec.ts'));
	write('verification.yaml', 'change: x\n');
	const weakened = commitAll('fix: drop the failing test');
	const head = git('rev-parse', 'HEAD');

	it('exits 1 with one line per problem for main..pr; rules out exit 0 on problems, or reporting merges and oracle commits', () => {
		const result = cli(`main..${head}`);
		expect(result.status).toBe(1);
		const lines = `${result.stdout}\n${result.stderr}`.split('\n');
		expect(lines.filter((line) => line.includes(implementerTest.slice(0, 7)) && line.includes('scripts/b.spec.ts'))).toHaveLength(1);
		expect(lines.filter((line) => line.includes(weakened.slice(0, 7)) && line.includes('scripts/b.spec.ts'))).toHaveLength(1);
		expect(lines.filter((line) => line.includes(weakened.slice(0, 7)) && line.includes('verification.yaml'))).toHaveLength(1);
		expect(lines.filter((line) => line.includes('e2e/b.e2e.ts') || line.includes('b.local.spec.ts') || line.includes('scripts/main.spec.ts'))).toEqual([]);
	});

	it('exits 0 on a range with no test changes; rules out failing every range', () => {
		expect(cli(`${base}..${clean}`).status).toBe(0);
	});
});
