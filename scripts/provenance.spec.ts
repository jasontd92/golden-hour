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

// why: `git show --remerge-diff --name-only` on 8ea54ee and bd58a69 prints nothing (both merged cleanly), so that is what commitsIn hands provenanceProblems for them
const asCommitsIn = (merge: Commit): Commit => ({ ...merge, files: [] });

describe('provenanceProblems on real history', () => {
	const range = [real('715de4c'), real('91fe627'), real('46ed249'), asCommitsIn(real('8ea54ee'))];

	// why: was "exactly the 4 known violations"; stryker.config.json is now runner config owned by the oracle, and 715de4c and 46ed249 both change it, so the same range has 6
	it('finds exactly the 6 known violations in origin/main..origin/ws12-stryker, one per (commit, test path), including stryker.config.json; rules out one problem per commit or per file, or leaving runner config to the implementer', () => {
		const problems = provenanceProblems(range);
		expect(problems).toHaveLength(6);
		for (const [sha, file] of [
			['715de4c', 'lint/rules/no-prose-comments.spec.ts'],
			['715de4c', 'scripts/mutation-scope.spec.ts'],
			['715de4c', 'stryker.config.json'],
			['91fe627', 'scripts/mutation-scope.spec.ts'],
			['46ed249', 'scripts/mutation-scope.spec.ts'],
			['46ed249', 'stryker.config.json']
		] as const) expect(mentions(problems, sha, file)).toHaveLength(1);
	});

	// why: was toHaveLength(1); 46ed249 also changes stryker.config.json, now a test path
	it('counts a deleted test (46ed249 removes scripts/mutation-scope.spec.ts) as changing it; rules out checking only added or modified files', () => {
		const problems = provenanceProblems([real('46ed249')]);
		expect(problems).toHaveLength(2);
		expect(mentions(problems, '46ed249', 'scripts/mutation-scope.spec.ts')).toHaveLength(1);
	});

	// why: replaces "exempts merge commits"; merges are no longer exempt by parent count, so a clean merge passes only because its remerge-diff is empty
	it('passes the real clean merges 8ea54ee and bd58a69 on their remerge-diff (nothing), but flags the six specs if handed their first-parent diff; rules out exempting merges by parent count instead of by what they changed', () => {
		for (const merge of [real('8ea54ee'), real('bd58a69')]) {
			expect(merge.parents).toBe(2);
			expect(provenanceProblems([asCommitsIn(merge)])).toEqual([]);
			const specs = merge.files.filter((file) => file.endsWith('.spec.ts'));
			expect(specs.length).toBeGreaterThan(0);
			expect(provenanceProblems([merge])).toHaveLength(specs.length);
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
	it.each(['src/lib/plan.spec.ts', 'scripts/canary.spec.ts', 'e2e/today.e2e.ts', 'root.spec.ts', 'lint/rules/deep/nested/x.spec.ts'])(
		'flags %s without the trailer; rules out a pattern that misses a test kind or depth',
		(file) => {
			expect(provenanceProblems([commit({ files: [file] })])).toHaveLength(1);
		}
	);

	it.each(['scripts/fixtures/oracle/commits.json', 'scripts/fixtures/oracle/migrated/run.json', 'src/lib/fixtures/sun.json', 'fixtures/top.json', 'vite.config.ts', 'playwright.config.ts', 'stryker.config.json'])(
		'flags test data or runner config %s without the trailer; rules out a guard on spec files alone, which lets an implementer weaken a test through its data or its config',
		(file) => {
			const problems = provenanceProblems([commit({ files: [file] })]);
			expect(problems).toHaveLength(1);
			expect(problems[0]).toContain(file);
		}
	);

	it('accepts test data and runner config with the trailer; rules out treating them as never committable', () => {
		expect(provenanceProblems([commit({ files: ['scripts/fixtures/oracle/commits.json', 'vite.config.ts', 'playwright.config.ts', 'stryker.config.json'], message: `test: x\n\n${trailer}\n` })])).toEqual([]);
	});

	// why: the local specs used to sit in this "ignores" list; a committed *.local.spec.ts is now always a problem (next describe)
	it.each(['src/lib/plan.ts', 'scripts/spec.ts.md', 'README.md', 'e2e/helpers.ts', 'verification/ledger/27.json', 'verification.yaml', 'scripts/verification.yaml', 'scripts/fixtures.ts', 'src/lib/myfixtures/a.json', 'svelte.config.js', 'docs/vite.config.ts.md'])(
		'ignores %s; rules out flagging non-test files, a loose "fixtures" or "config" substring match, or still guarding the dropped verification.yaml',
		(file) => {
			expect(provenanceProblems([commit({ files: [file] })])).toEqual([]);
		}
	);
});

describe('provenanceProblems: committed *.local.spec.ts', () => {
	it.each(['scripts/canary.local.spec.ts', 'src/lib/x.local.spec.ts'])('flags %s exactly once, with or without the trailer; rules out ignoring local checks, letting the trailer excuse them, or reporting them twice', (file) => {
		for (const message of ['chore: my own check\n', `test: x\n\n${trailer}\n`]) {
			const problems = provenanceProblems([commit({ files: ['src/lib/plan.ts', file], message })]);
			expect(problems).toHaveLength(1);
			expect(problems[0]).toContain(file);
		}
	});

	it('flags a local spec in a merge too; rules out judging only ordinary commits', () => {
		expect(provenanceProblems([commit({ parents: 2, files: ['scripts/a.local.spec.ts'], message: `Merge branch 'main'\n\n${trailer}\n` })])).toHaveLength(1);
	});
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

	// why: replaces "exempts a merge with any number of parents ≥ 2"; a merge is now judged on its (remerge-diff) files like any commit
	it('judges a merge of 2 or 3 parents, and a root commit, on its files like any other commit; rules out an exemption by parent count', () => {
		for (const parents of [0, 2, 3]) {
			expect(provenanceProblems([commit({ parents, files: tests })])).toHaveLength(1);
			expect(provenanceProblems([commit({ parents, files: tests, message: `Merge\n\n${trailer}\n` })])).toEqual([]);
			expect(provenanceProblems([commit({ parents, files: [] })])).toEqual([]);
		}
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
	const localCheck = commitAll('chore: my own check');
	git('checkout', '-q', 'main');
	write('scripts/main.spec.ts');
	commitAll('test: landed on main through its own PR');
	git('checkout', '-q', 'pr');
	git('merge', '-q', '--no-ff', '--no-edit', 'main');
	const cleanMerge = git('rev-parse', 'HEAD');
	rmSync(path.join(dir, 'scripts/b.spec.ts'));
	write('verification.yaml', 'change: x\n');
	const weakened = commitAll('fix: drop the failing test');
	write('src/fixtures/sun.json', '{"sunset":"18:00"}\n');
	const data = commitAll('chore: refresh the sun data');
	const head = git('rev-parse', 'HEAD');

	// why: both sides change the same spec and source file through oracle commits, then the merge resolves the conflicts by hand with no trailer
	git('checkout', '-q', '-b', 'conflict', head);
	const conflictBase = head;
	write('scripts/shared.spec.ts', 'base\n');
	write('src/shared.ts', 'base\n');
	commitAll(`test: shared\n\n${trailer}\n`);
	git('checkout', '-q', '-b', 'other');
	write('scripts/shared.spec.ts', 'other\n');
	write('src/shared.ts', 'other\n');
	commitAll(`test: other side\n\n${trailer}\n`);
	git('checkout', '-q', 'conflict');
	write('scripts/shared.spec.ts', 'mine\n');
	write('src/shared.ts', 'mine\n');
	commitAll(`test: my side\n\n${trailer}\n`);
	spawnSync('git', ['merge', '-q', '--no-ff', '--no-edit', 'other'], { cwd: dir });
	write('scripts/shared.spec.ts', 'resolved, and the assertion weakened\n');
	write('src/shared.ts', 'resolved\n');
	const resolved = commitAll("Merge branch 'other' into conflict");

	// why: was "rules out reporting ... local specs": a committed *.local.spec.ts is now a problem, and the range gained a fixtures commit
	it('exits 1 with one line per problem for main..pr, including the committed local spec and the fixture; rules out exit 0 on problems, or reporting the clean merge, oracle commits or the now-ordinary verification.yaml', () => {
		const result = cli(`main..${head}`);
		expect(result.status).toBe(1);
		const lines = `${result.stdout}\n${result.stderr}`.split('\n');
		const of = (sha: string) => lines.filter((line) => line.includes(sha.slice(0, 7)));
		expect(of(implementerTest).filter((line) => line.includes('scripts/b.spec.ts'))).toHaveLength(1);
		expect(of(weakened).filter((line) => line.includes('scripts/b.spec.ts'))).toHaveLength(1);
		expect(of(localCheck).filter((line) => line.includes('scripts/b.local.spec.ts'))).toHaveLength(1);
		expect(of(data).filter((line) => line.includes('src/fixtures/sun.json'))).toHaveLength(1);
		expect(of(cleanMerge)).toEqual([]);
		expect(lines.filter((line) => line.includes('e2e/b.e2e.ts') || line.includes('scripts/main.spec.ts') || line.includes('verification.yaml'))).toEqual([]);
		expect([implementerTest, weakened, localCheck, data].flatMap(of)).toHaveLength(4);
	});

	it('reports a merge whose hand-resolved conflict changes a spec without the trailer, naming only the spec; rules out exempting merges, or reading a merge with plain diff-tree (which lists nothing)', () => {
		const result = cli(`${conflictBase}..${resolved}`);
		expect(result.status).toBe(1);
		const lines = `${result.stdout}\n${result.stderr}`.split('\n').filter((line) => line.includes(resolved.slice(0, 7)));
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain('scripts/shared.spec.ts');
	});

	it('passes a clean merge that brings a spec in from main; rules out judging a merge on its first-parent diff', () => {
		const merge = git('show', '-s', '--format=%P', cleanMerge).split(' ');
		expect(merge).toHaveLength(2);
		expect(git('diff', '--name-only', merge[0]!, cleanMerge)).toContain('scripts/main.spec.ts');
		expect(cli(`${cleanMerge}^!`).status).toBe(0);
	});

	it('exits 0 on a range with no test changes; rules out failing every range', () => {
		expect(cli(`${base}..${clean}`).status).toBe(0);
	});
});
