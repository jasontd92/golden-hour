import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { judgeCommit, judgeMerge } from './guard.ts';

const trailer = 'Verified-by: oracle';
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/oracle/${name}`, import.meta.url), 'utf8')) as { name: string; bucket: string }[];

describe('judgeCommit', () => {
	const commit = 'git commit -m "feat: x"';

	it.each(['scripts/canary.spec.ts', 'e2e/today.e2e.ts', 'src/lib/deep/x.spec.ts', 'root.spec.ts'])('blocks staging %s outside the oracle, with a reason; rules out a guard that misses a test kind', (file) => {
		const verdict = judgeCommit(commit, ['src/lib/plan.ts', file], undefined);
		expect(verdict.allow).toBe(false);
		if (!verdict.allow) expect(verdict.reason).toContain(file);
	});

	it.each([undefined, '', 'implementer', 'Oracle', 'oracle ', 'not-oracle'])('treats ROLE=%j as not the oracle; rules out a truthy or case-insensitive role check', (role) => {
		expect(judgeCommit(commit, ['scripts/canary.spec.ts'], role).allow).toBe(false);
	});

	it('allows the oracle to commit tests with the trailer', () => {
		expect(judgeCommit(`git commit -m "test: x" -m "${trailer}"`, ['scripts/canary.spec.ts', 'e2e/today.e2e.ts'], 'oracle')).toEqual({ allow: true });
	});

	it('allows an implementer commit with no test paths, including its own *.local.spec.ts and verification.yaml (now an ordinary file); rules out blocking every commit, or still guarding verification.yaml', () => {
		expect(judgeCommit(commit, ['src/lib/plan.ts', 'scripts/canary.local.spec.ts', 'README.md', 'verification.yaml'], undefined)).toEqual({ allow: true });
		expect(judgeCommit(commit, [], 'implementer')).toEqual({ allow: true });
	});

	it('blocks the trailer text outside the oracle even when no tests are staged; rules out checking the trailer only alongside tests', () => {
		for (const command of [`git commit -m "fix: x" -m "${trailer}"`, `git commit -m "$(printf 'fix: x\\n\\n${trailer}')"`]) {
			const verdict = judgeCommit(command, ['src/lib/plan.ts'], undefined);
			expect(verdict.allow).toBe(false);
			if (!verdict.allow) expect(verdict.reason.length).toBeGreaterThan(0);
		}
	});
});

describe('judgeMerge', () => {
	it('allows real PR #27, whose checks are all pass or skipping; rules out treating skipping as not green', () => {
		const checks = fixture('pr-checks-27.json');
		expect(checks.some(({ bucket }) => bucket === 'skipping')).toBe(true);
		expect(judgeMerge(checks)).toEqual({ allow: true });
	});

	it('blocks real PR #35 (checks fail, evidence cancel, e2e pending) and names what is not green', () => {
		const verdict = judgeMerge(fixture('pr-checks-35.json'));
		expect(verdict.allow).toBe(false);
		if (!verdict.allow) for (const name of ['checks', 'evidence', 'e2e']) expect(verdict.reason).toContain(name);
	});

	it.each(['fail', 'pending', 'cancel', 'neutral', ''])('blocks a single %j among passes; rules out "no failures" instead of "all green"', (bucket) => {
		expect(judgeMerge([{ name: 'checks', bucket: 'pass' }, { name: 'e2e', bucket }, { name: 'production', bucket: 'skipping' }]).allow).toBe(false);
	});

	it('blocks when no checks are reported; rules out vacuous truth on an empty list', () => {
		const verdict = judgeMerge([]);
		expect(verdict.allow).toBe(false);
		if (!verdict.allow) expect(verdict.reason.length).toBeGreaterThan(0);
	});
});

describe('guard hook (stdin JSON, exit 2 blocks with the reason on stderr)', () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'guard-'));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));
	const repo = path.join(dir, 'repo');
	const bin = path.join(dir, 'bin');
	const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8' });
	execFileSync('mkdir', ['-p', path.join(repo, 'scripts'), bin]);
	git('init', '-q');
	writeFileSync(path.join(repo, 'scripts/a.spec.ts'), 'x\n');
	writeFileSync(path.join(repo, 'scripts/a.ts'), 'x\n');
	git('add', '-A');
	git('commit', '-q', '-m', 'init');
	// why: a stand-in gh that records its arguments and prints the checks the test chose, so the merge path runs without the network
	writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho "$@" > "${dir}/gh-args"\ncat "${dir}/gh-out"\n`);
	chmodSync(path.join(bin, 'gh'), 0o755);

	const hook = (command: string, env: Record<string, string | undefined> = {}, cwd?: string) => {
		const { ROLE: _role, ...rest } = process.env;
		return spawnSync('node', [path.resolve('scripts/hooks/guard.ts')], {
			cwd,
			input: JSON.stringify({ cwd: repo, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
			encoding: 'utf8',
			env: { ...rest, PATH: `${bin}:${process.env.PATH}`, ...env }
		});
	};
	const reset = () => git('reset', '-q', '--hard');

	it('blocks a commit that stages a test, exit 2 with the reason on stderr; allows it under ROLE=oracle', () => {
		writeFileSync(path.join(repo, 'scripts/a.spec.ts'), 'y\n');
		git('add', 'scripts/a.spec.ts');
		const blocked = hook('git commit -m "fix: tests"');
		expect(blocked.status).toBe(2);
		expect(blocked.stderr).toContain('scripts/a.spec.ts');
		expect(hook('git commit -m "test: a" -m "Verified-by: oracle"', { ROLE: 'oracle' }).status).toBe(0);
		reset();
	});

	it('blocks git commit -a when a tracked test is modified but not yet staged; rules out reading only the index', () => {
		writeFileSync(path.join(repo, 'scripts/a.spec.ts'), 'z\n');
		expect(hook('git commit -am "fix: tests"').status).toBe(2);
		reset();
	});

	it('allows a commit that stages only source, and commands that are not commits; rules out blocking everything', () => {
		writeFileSync(path.join(repo, 'scripts/a.ts'), 'y\n');
		git('add', 'scripts/a.ts');
		expect(hook('git commit -m "fix: a"').status).toBe(0);
		expect(hook('git status').status).toBe(0);
		expect(hook('ls scripts').status).toBe(0);
		reset();
	});

	it('blocks the trailer in an implementer commit of source only', () => {
		writeFileSync(path.join(repo, 'scripts/a.ts'), 'w\n');
		git('add', 'scripts/a.ts');
		const blocked = hook('git commit -m "fix: a" -m "Verified-by: oracle"');
		expect(blocked.status).toBe(2);
		expect(blocked.stderr.trim().length).toBeGreaterThan(0);
		reset();
	});

	it('blocks gh pr merge on real PR #35 checks and asks gh about the PR named in the command', () => {
		writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-35.json', import.meta.url)));
		const blocked = hook('gh pr merge 35 --squash');
		expect(blocked.status).toBe(2);
		expect(blocked.stderr).toContain('checks');
		expect(readFileSync(path.join(dir, 'gh-args'), 'utf8')).toMatch(/\b35\b/);
	});

	const records = (root: string) => globSync(`${root}/verification/runs/*.json`).sort();

	it('records each block as {by: guard, result: blocked, detail: the reason} in the repo of the input cwd, not the hook process cwd; rules out writing to the wrong repo or a vague detail', () => {
		const elsewhere = path.join(dir, 'elsewhere');
		execFileSync('mkdir', ['-p', elsewhere]);
		execFileSync('git', ['init', '-q'], { cwd: elsewhere });
		const before = records(repo);
		writeFileSync(path.join(repo, 'scripts/a.spec.ts'), 'v\n');
		git('add', 'scripts/a.spec.ts');
		const blocked = hook('git commit -m "fix: tests"', {}, elsewhere);
		expect(blocked.status).toBe(2);
		const added = records(repo).filter((file) => !before.includes(file));
		expect(added).toHaveLength(1);
		const record = JSON.parse(readFileSync(added[0]!, 'utf8')) as Record<string, unknown>;
		expect(record).toEqual({ at: expect.any(String), by: 'guard', result: 'blocked', detail: blocked.stderr.trim() });
		expect(record.detail).toContain('scripts/a.spec.ts');
		expect(path.basename(added[0]!)).toBe(`${(record.at as string).replace(/[:.]/g, '-')}-guard.json`);
		expect(records(elsewhere)).toEqual([]);
		reset();
	});

	it('records a blocked merge too, and records nothing for an allowed commit or merge; rules out recording every hook call', () => {
		writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-35.json', import.meta.url)));
		let before = records(repo);
		expect(hook('gh pr merge 35 --squash').status).toBe(2);
		const added = records(repo).filter((file) => !before.includes(file));
		expect(added).toHaveLength(1);
		expect(JSON.parse(readFileSync(added[0]!, 'utf8'))).toMatchObject({ by: 'guard', result: 'blocked', detail: expect.stringContaining('checks') });
		before = records(repo);
		writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-27.json', import.meta.url)));
		expect(hook('gh pr merge 27 --squash').status).toBe(0);
		writeFileSync(path.join(repo, 'scripts/a.ts'), 'u\n');
		git('add', 'scripts/a.ts');
		expect(hook('git commit -m "fix: a"').status).toBe(0);
		expect(hook('git status').status).toBe(0);
		expect(records(repo)).toEqual(before);
		reset();
	});

	it('allows gh pr merge on real PR #27 checks, and blocks when gh reports none', () => {
		writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-27.json', import.meta.url)));
		expect(hook('gh pr merge 27 --squash').status).toBe(0);
		writeFileSync(path.join(dir, 'gh-out'), '[]');
		expect(hook('gh pr merge 27 --squash').status).toBe(2);
	});
});
