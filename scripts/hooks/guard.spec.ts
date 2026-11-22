import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { hasOracleTrailer } from '../provenance.ts';
import { commitMessageSources, judgeCommit, judgeMerge, mergeTarget } from './guard.ts';

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

	// why: used to include scripts/canary.local.spec.ts in the allowed list; a *.local.spec.ts is now refused (next test)
	it('allows an implementer commit with no test paths, including verification.yaml (now an ordinary file); rules out blocking every commit, or still guarding verification.yaml', () => {
		expect(judgeCommit(commit, ['src/lib/plan.ts', 'README.md', 'verification.yaml', 'svelte.config.js'], undefined)).toEqual({ allow: true });
		expect(judgeCommit(commit, [], 'implementer')).toEqual({ allow: true });
	});

	it.each([undefined, 'implementer', 'oracle'])('refuses a *.local.spec.ts under ROLE=%j, even with the trailer, naming it; rules out an oracle exemption for local checks', (role) => {
		const verdict = judgeCommit(`git commit -m "test: x" -m "${trailer}"`, ['scripts/canary.spec.ts', 'scripts/canary.local.spec.ts'], role);
		expect(verdict.allow).toBe(false);
		if (!verdict.allow) expect(verdict.reason).toContain('scripts/canary.local.spec.ts');
	});

	it.each(['scripts/fixtures/oracle/commits.json', 'src/fixtures/a.json', 'vite.config.ts', 'playwright.config.ts', 'stryker.config.json'])('blocks test data or runner config %s outside the oracle and allows it for the oracle; rules out guarding spec files alone', (file) => {
		expect(judgeCommit(commit, [file], undefined).allow).toBe(false);
		expect(judgeCommit(`git commit -m "test: x" -m "${trailer}"`, [file], 'oracle')).toEqual({ allow: true });
	});

	it('blocks the trailer text outside the oracle even when no tests are staged; rules out checking the trailer only alongside tests', () => {
		for (const command of [`git commit -m "fix: x" -m "${trailer}"`, `git commit -m "$(printf 'fix: x\\n\\n${trailer}')"`]) {
			const verdict = judgeCommit(command, ['src/lib/plan.ts'], undefined);
			expect(verdict.allow).toBe(false);
			if (!verdict.allow) expect(verdict.reason.length).toBeGreaterThan(0);
		}
	});
});

describe('commitMessageSources', () => {
	it.each([
		['git commit -F msg.txt', 'msg.txt'],
		['git commit -Fmsg.txt', 'msg.txt'],
		['git commit --file msg.txt', 'msg.txt'],
		['git commit --file=msg.txt', 'msg.txt'],
		['git add -A && git commit -q -F "notes/my msg.txt"', 'notes/my msg.txt']
	])('finds the message file in %s; rules out reading only -m', (command, file) => {
		expect(commitMessageSources(command).files).toEqual([file]);
	});

	it.each([
		['git commit -C abc123', 'abc123'],
		['git commit -c abc123', 'abc123'],
		['git commit --reuse-message abc123', 'abc123'],
		['git commit --reuse-message=abc123', 'abc123'],
		['git commit --reedit-message=abc123', 'abc123']
	])('finds the reused commit in %s; rules out ignoring a message copied from another commit', (command, sha) => {
		expect(commitMessageSources(command).commits).toEqual([sha]);
	});

	it.each(['git commit -m "fix: x" --trailer Verified-by=oracle', 'git commit -m "fix: x" --trailer "Verified-by:oracle"', 'git commit -m "fix: x" --trailer=Verified-by=oracle', 'git commit -m "fix: x" --trailer "Verified-by = oracle"'])(
		'turns %s into the real trailer line; rules out a literal search that misses the = and : spellings git accepts',
		(command) => {
			expect(hasOracleTrailer(commitMessageSources(command).text)).toBe(true);
		}
	);

	it('stops at the end of the git commit command, so a later -F belongs to another program; and reads nothing from a plain -m commit', () => {
		expect(commitMessageSources('git commit -m "fix: x" && grep -F foo bar.txt')).toMatchObject({ files: [], commits: [] });
		expect(commitMessageSources('git commit -m "fix: x"')).toMatchObject({ files: [], commits: [] });
	});
});

describe('mergeTarget', () => {
	it.each([
		['gh pr merge 37', { pr: '37' }],
		['gh pr merge 37 --squash', { pr: '37' }],
		['gh pr merge --squash 37', { pr: '37' }],
		['gh pr merge --squash -t title 37', { pr: '37' }],
		['gh pr merge --squash -t "feat: two words" 37', { pr: '37' }],
		['gh pr merge --squash --body "after 36 went green" 37', { pr: '37' }],
		['gh pr merge --subject title --body body 37 --delete-branch', { pr: '37' }],
		['gh pr merge https://github.com/jasontd92/golden-hour/pull/37 --squash', { pr: 'https://github.com/jasontd92/golden-hour/pull/37' }],
		['gh pr merge ci/oracle-provenance --merge', { pr: 'ci/oracle-provenance' }],
		['gh pr merge 37 -R jasontd92/golden-hour', { pr: '37', repo: 'jasontd92/golden-hour' }],
		['gh pr merge --repo jasontd92/golden-hour --squash 37', { pr: '37', repo: 'jasontd92/golden-hour' }],
		['gh pr merge --repo=jasontd92/golden-hour 37', { pr: '37', repo: 'jasontd92/golden-hour' }],
		['gh pr merge --squash', {}],
		['gh pr merge --squash && git push origin 12', {}],
		['cd repo && gh pr merge 37 --auto', { pr: '37' }]
	])('reads %s as %j; rules out taking only the first argument, a flag value as the PR, or words after the command', (command, target) => {
		expect(mergeTarget(command)).toEqual(target);
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
	writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho "$@" > "${dir}/gh-args"\ncat "${dir}/gh-out"\nexit $(cat "${dir}/gh-status" 2>/dev/null || echo 0)\n`);
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

	const clean = () => {
		git('reset', '-q', '--hard');
		git('clean', '-fdq');
	};
	const stage = (file: string, text = `${Math.random()}\n`) => {
		execFileSync('mkdir', ['-p', path.dirname(path.join(repo, file))]);
		writeFileSync(path.join(repo, file), text);
	};

	describe('fails closed', () => {
		it('refuses gh pr merge with exit 2 when gh pr checks fails (exit 1), even if it printed green checks; rules out an error waving the merge through', () => {
			writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-27.json', import.meta.url)));
			writeFileSync(path.join(dir, 'gh-status'), '1');
			try {
				const blocked = hook('gh pr merge 27 --squash');
				expect(blocked.status).toBe(2);
				expect(blocked.stderr.trim().length).toBeGreaterThan(0);
			} finally {
				rmSync(path.join(dir, 'gh-status'));
			}
		});

		it('refuses gh pr merge when gh prints something that is not JSON; rules out a parse error crashing with exit 1, which Claude Code does not block on', () => {
			writeFileSync(path.join(dir, 'gh-out'), 'no checks reported on the branch\n');
			expect(hook('gh pr merge 27').status).toBe(2);
		});

		it('refuses a commit when git cannot be read (input cwd is not a repo) or the -F file is missing; rules out allowing what it could not check', () => {
			const { ROLE: _role, ...rest } = process.env;
			const notRepo = mkdtempSync(path.join(tmpdir(), 'guard-norepo-'));
			try {
				const result = spawnSync('node', [path.resolve('scripts/hooks/guard.ts')], { input: JSON.stringify({ cwd: notRepo, tool_input: { command: 'git commit -m "fix: x"' } }), encoding: 'utf8', env: { ...rest, GIT_CEILING_DIRECTORIES: path.dirname(notRepo) } });
				expect(result.status).toBe(2);
			} finally {
				rmSync(notRepo, { recursive: true, force: true });
			}
			stage('scripts/a.ts');
			git('add', 'scripts/a.ts');
			expect(hook('git commit -F missing-message.txt').status).toBe(2);
			clean();
		});
	});

	describe('every way a commit can include a test path', () => {
		it.each([
			['path argument', 'git commit -m "fix: x" scripts/a.spec.ts'],
			['-i', 'git commit -i scripts/a.spec.ts -m "fix: x"'],
			['--all', 'git commit --all -m "fix: x"'],
			['-a after other flags', 'git commit -q -a -m "fix: x"']
		])('blocks a modified, unstaged tracked test committed by %s; rules out reading only the index', (_, command) => {
			stage('scripts/a.spec.ts');
			const blocked = hook(command);
			expect(blocked.status).toBe(2);
			expect(blocked.stderr).toContain('scripts/a.spec.ts');
			clean();
		});

		it('blocks a new untracked test added in the same command (git add ... && git commit); rules out missing files a chained git add has not staged yet', () => {
			stage('scripts/new.spec.ts');
			stage('scripts/fixtures/new.json');
			const blocked = hook('git add scripts/new.spec.ts scripts/fixtures/new.json && git commit -m "fix: x"');
			expect(blocked.status).toBe(2);
			expect(blocked.stderr).toContain('scripts/new.spec.ts');
			clean();
		});

		it('blocks --amend --no-edit of a HEAD that changed a test, with nothing staged; and allows a plain commit with nothing staged on the same HEAD; rules out ignoring the amended commit, or always counting HEAD', () => {
			stage('scripts/a.spec.ts');
			git('commit', '-q', '-am', 'test: a');
			try {
				expect(hook('git commit --amend --no-edit').status).toBe(2);
				expect(hook('git commit --allow-empty -m "chore: nothing"').status).toBe(0);
			} finally {
				git('reset', '-q', '--hard', 'HEAD~1');
			}
		});

		it('blocks a staged *.local.spec.ts even for the oracle with the trailer; rules out the oracle committing local checks', () => {
			stage('scripts/mine.local.spec.ts');
			git('add', '-f', 'scripts/mine.local.spec.ts');
			const blocked = hook('git commit -m "test: x" -m "Verified-by: oracle"', { ROLE: 'oracle' });
			expect(blocked.status).toBe(2);
			expect(blocked.stderr).toContain('scripts/mine.local.spec.ts');
			clean();
		});
	});

	describe('the trailer, wherever it would come from', () => {
		const oracleCommit = git('commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', `test: by the oracle\n\n${trailer}\n`).trim();
		const plainCommit = git('commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'fix: plain\n').trim();
		const elsewhere = mkdtempSync(path.join(tmpdir(), 'guard-cwd-'));
		afterAll(() => rmSync(elsewhere, { recursive: true, force: true }));

		it.each([
			['-F <file>', 'git commit -F msg.txt'],
			['--file=<file>', 'git commit --file=msg.txt'],
			['--trailer Verified-by=oracle', 'git commit -m "fix: x" --trailer Verified-by=oracle'],
			['--trailer Verified-by:oracle', 'git commit -m "fix: x" --trailer Verified-by:oracle'],
			['-C <oracle commit>', `git commit -C ${oracleCommit}`],
			['-c <oracle commit>', `git commit -c ${oracleCommit}`],
			['--reuse-message=<oracle commit>', `git commit --reuse-message=${oracleCommit}`]
		])('blocks %s outside the oracle on a source-only commit, reading files relative to the input cwd; rules out checking only the command text', (_, command) => {
			stage('msg.txt', `fix: a\n\n${trailer}\n`);
			stage('scripts/a.ts');
			git('add', 'scripts/a.ts');
			const blocked = hook(command, {}, elsewhere);
			expect(blocked.status).toBe(2);
			expect(blocked.stderr).toContain('oracle');
			clean();
		});

		it('allows the same -F file and -C commit under ROLE=oracle with a staged test; rules out refusing the trailer for everyone', () => {
			stage('msg.txt', `test: a\n\n${trailer}\n`);
			stage('scripts/a.spec.ts');
			git('add', 'scripts/a.spec.ts');
			expect(hook('git commit -F msg.txt', { ROLE: 'oracle' }, elsewhere).status).toBe(0);
			expect(hook(`git commit -C ${oracleCommit}`, { ROLE: 'oracle' }).status).toBe(0);
			clean();
		});

		it('allows -F and -C sources without the trailer; rules out blocking every -F or -C', () => {
			stage('msg.txt', 'fix: a\n');
			stage('scripts/a.ts');
			git('add', 'scripts/a.ts');
			expect(hook('git commit -F msg.txt', {}, elsewhere).status).toBe(0);
			expect(hook(`git commit -C ${plainCommit}`).status).toBe(0);
			clean();
		});

		it('blocks --amend --no-edit of a HEAD that carries the trailer, outside the oracle; rules out ignoring the message being amended', () => {
			const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
			git('checkout', '-q', oracleCommit);
			try {
				expect(hook('git commit --amend --no-edit').status).toBe(2);
				expect(hook('git commit --amend --no-edit', { ROLE: 'oracle' }).status).toBe(0);
			} finally {
				git('checkout', '-q', branch);
			}
		});
	});

	describe('gh pr merge names its PR anywhere', () => {
		const green = () => writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-27.json', import.meta.url)));
		const ghArgs = () => readFileSync(path.join(dir, 'gh-args'), 'utf8').trim();

		it.each([
			['gh pr merge --squash 35', '35'],
			['gh pr merge --squash -t title 35', '35'],
			['gh pr merge https://github.com/jasontd92/golden-hour/pull/35 --squash', 'https://github.com/jasontd92/golden-hour/pull/35'],
			['gh pr merge ws12-stryker --merge', 'ws12-stryker']
		])('asks gh pr checks about the PR in %s; rules out checking the current branch instead', (command, pr) => {
			green();
			expect(hook(command).status).toBe(0);
			expect(ghArgs().split(' ')).toContain(pr);
			expect(ghArgs()).not.toMatch(/\btitle\b/);
		});

		it('checks PR 35 (red), not the 36 inside a quoted --body, for gh pr merge --squash --body "after 36 went green" 35; rules out splitting the command on spaces, which would merge a red PR on a green one\'s checks', () => {
			writeFileSync(path.join(dir, 'gh-out'), readFileSync(new URL('../fixtures/oracle/pr-checks-35.json', import.meta.url)));
			expect(hook('gh pr merge --squash --body "after 36 went green" 35').status).toBe(2);
			expect(ghArgs().split(' ')).toContain('35');
			expect(ghArgs().split(' ')).not.toContain('36');
		});

		it('passes -R/--repo through to gh pr checks; rules out checking the same number in the wrong repo', () => {
			green();
			hook('gh pr merge 35 -R jasontd92/golden-hour --squash');
			expect(ghArgs()).toMatch(/--repo jasontd92\/golden-hour\b/);
			hook('gh pr merge --repo=jasontd92/golden-hour 35');
			expect(ghArgs()).toMatch(/--repo jasontd92\/golden-hour\b/);
		});

		it('with no PR named, asks about the current branch (no PR argument); rules out passing a flag as the PR', () => {
			green();
			expect(hook('gh pr merge --squash').status).toBe(0);
			expect(ghArgs()).toBe('pr checks --json name,bucket');
		});
	});
});
