import * as nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { formatTable, runningWindowMs, scoreSessions, type ScoredSession } from './score-sessions.ts';
import type { Run } from './sessions/github.ts';
import { commandKey, mentionsPath, repoPath } from './sessions/metrics.ts';
import {
	candidateTranscripts,
	readChunkBytes,
	readRepoTranscript,
	repoCwdMatcher,
	type TranscriptFs
} from './sessions/transcripts.ts';

const projectsDir = path.join(import.meta.dirname, 'sessions/fixtures/projects');
const root = '/work/golden-hour';
const fixture = (file: string): string => path.join(projectsDir, file);
const mainSession = fixture('-work-golden-hour/11111111-aaaa-4bbb-8ccc-000000000001.jsonl');
const emSession = fixture('-work/pm-0001/subagents/agent-a0000000000000001.jsonl');
const foreignSubagent = fixture('-work/pm-0001/subagents/agent-a0000000000000002.jsonl');

const responses: Record<string, string> = {
	'git show --name-only --format= abc1234': 'src/app.ts\n',
	'git log origin/main --format=%x00%s --name-only':
		'\0Revert "feat: tool"\n\nscripts/tool.ts\n\0feat: other\n\nsrc/other.ts\n',
	'gh auth status': 'ok',
	'gh pr view 7 --json headRefName,files,commits': JSON.stringify({
		headRefName: 'ws9-branch',
		files: [{ path: 'scripts/tool.ts' }],
		commits: [{ oid: 'def5678def5678def5678def5678def5678def56' }, { oid: 'abc1234abc1234abc1234abc1234abc1234abc12' }]
	}),
	'gh run list --branch ws9-branch --event pull_request --limit 200 --json conclusion,createdAt': JSON.stringify([
		{ conclusion: 'success', createdAt: '2030-01-01T10:40:00Z' },
		{ conclusion: 'failure', createdAt: '2030-01-01T10:30:00Z' },
		{ conclusion: 'success', createdAt: '2030-01-01T10:35:00Z' }
	])
};

const fakeRun =
	(withGh: boolean): Run =>
	(cmd, args) => {
		if (cmd === 'gh' && !withGh) return null;
		if (cmd === 'gh' && args[0] === 'api') {
			return JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { totalCount: 2 } } } } });
		}
		return responses[[cmd, ...args].join(' ')] ?? null;
	};

const later = Date.parse('2031-01-01T00:00:00Z');
const score = (withGh: boolean, now = later) =>
	scoreSessions({ root, projectsDir, run: fakeRun(withGh), github: true, now });

interface FsSpy {
	fs: TranscriptFs;
	touched: string[];
	bytesRead: Map<string, number>;
}

function spyFs(): FsSpy {
	const touched: string[] = [];
	const bytesRead = new Map<string, number>();
	const openFiles = new Map<number, string>();
	const fs = new Proxy(nodeFs, {
		get(target, name: keyof typeof nodeFs) {
			const real = target[name];
			if (typeof real !== 'function') return real;
			return (...args: unknown[]) => {
				if (typeof args[0] === 'string') touched.push(args[0]);
				const result = (real as (...a: unknown[]) => unknown).apply(target, args);
				if (name === 'openSync' && typeof args[0] === 'string') openFiles.set(result as number, args[0]);
				if (name === 'readSync') {
					const file = openFiles.get(args[0] as number) ?? '';
					bytesRead.set(file, (bytesRead.get(file) ?? 0) + (result as number));
				}
				return result;
			};
		}
	});
	return { fs, touched, bytesRead };
}

const tempRoots: string[] = [];
afterAll(() => {
	for (const dir of tempRoots) nodeFs.rmSync(dir, { recursive: true, force: true });
});

function writeProjects(files: Record<string, string>): string {
	const dir = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'score-sessions-'));
	tempRoots.push(dir);
	for (const [file, content] of Object.entries(files)) {
		nodeFs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		nodeFs.writeFileSync(path.join(dir, file), content);
	}
	return dir;
}

const record = (cwd: string): string => `${JSON.stringify({ type: 'user', cwd, message: { content: 'x' } })}\n`;

const byLabel = (sessions: ScoredSession[], label: string): ScoredSession => {
	const session = sessions.find((candidate) => candidate.label === label);
	if (!session) throw new Error(`missing session ${label}`);
	return session;
};

describe('privacy', () => {
	it('lists only repo, worktree and ancestor-subagent transcripts as candidates', () => {
		const relative = candidateTranscripts(projectsDir, root).map((file) => path.relative(projectsDir, file));
		expect(relative.sort()).toEqual([
			'-work-golden-hour/11111111-aaaa-4bbb-8ccc-000000000001.jsonl',
			'-work-golden-hour/44444444-aaaa-4bbb-8ccc-000000000004.jsonl',
			'-work/pm-0001/subagents/agent-a0000000000000001.jsonl',
			'-work/pm-0001/subagents/agent-a0000000000000002.jsonl'
		]);
	});

	it('never touches a foreign project folder, an ancestor above the parent or a lookalike sibling', () => {
		const deepRoot = '/home/me/work/golden-hour';
		const repo = record(deepRoot);
		const projects = writeProjects({
			'-home-me-work-golden-hour/s1.jsonl': repo,
			'-home-me-work-golden-hour-wt-ws1/s2.jsonl': record(`${deepRoot}-wt/ws1`),
			'-home-me-work/pm/subagents/agent-a1.jsonl': record(`${deepRoot}-wt/ws1`),
			'-home-me-work/pm.jsonl': repo,
			'-home-me/pm/subagents/agent-a2.jsonl': repo,
			'-home/pm/subagents/agent-a3.jsonl': repo,
			'-home-me-work-golden-hour-other/s3.jsonl': repo,
			'-home-me-other/s4.jsonl': repo
		});
		const spy = spyFs();
		const found = candidateTranscripts(projects, deepRoot, spy.fs).map((file) => path.relative(projects, file));
		expect(found.sort()).toEqual([
			'-home-me-work-golden-hour-wt-ws1/s2.jsonl',
			'-home-me-work-golden-hour/s1.jsonl',
			'-home-me-work/pm/subagents/agent-a1.jsonl'
		]);
		const foreign = ['-home-me', '-home', '-home-me-work-golden-hour-other', '-home-me-other'];
		const touchedFolders = spy.touched.map((file) => path.relative(projects, file).split(path.sep)[0]);
		expect(touchedFolders.filter((folder) => foreign.includes(folder ?? ''))).toEqual([]);
	});

	it('rejects a foreign transcript after reading only its first record', () => {
		const first = record('/work/other');
		const projects = writeProjects({ 'big.jsonl': first + record('/work/golden-hour').repeat(5000) });
		const spy = spyFs();
		expect(readRepoTranscript(path.join(projects, 'big.jsonl'), repoCwdMatcher(root), spy.fs)).toBeNull();
		expect(spy.bytesRead.get(path.join(projects, 'big.jsonl'))).toBeLessThanOrEqual(first.length + readChunkBytes);
	});

	it('reads records that span several chunks', () => {
		const long = `${JSON.stringify({ type: 'user', cwd: root, message: { content: 'y'.repeat(readChunkBytes * 3) } })}\n`;
		const projects = writeProjects({ 'long.jsonl': long + long.trimEnd() });
		const transcript = readRepoTranscript(path.join(projects, 'long.jsonl'), repoCwdMatcher(root));
		expect(transcript).not.toBeNull();
	});

	it('skips a transcript whose first cwd is foreign, even if later records are in the repo', () => {
		expect(readRepoTranscript(foreignSubagent, repoCwdMatcher(root))).toBeNull();
	});

	it('skips a transcript that never records a cwd', () => {
		const noCwd = fixture('-work-golden-hour/44444444-aaaa-4bbb-8ccc-000000000004.jsonl');
		expect(readRepoTranscript(noCwd, repoCwdMatcher(root))).toBeNull();
	});

	it('ignores foreign-cwd records inside a repo transcript', () => {
		const transcript = readRepoTranscript(mainSession, repoCwdMatcher(root));
		expect(transcript?.calls.map((call) => call.id)).not.toContain('tx');
	});

	it('reads a worktree subagent and labels it from its meta file', () => {
		expect(readRepoTranscript(emSession, repoCwdMatcher(root))?.label).toBe('ws9-impl');
	});

	it('matches the repo, its worktrees and nothing else', () => {
		const isRepo = repoCwdMatcher(root);
		expect(['/work/golden-hour', '/work/golden-hour/src', '/work/golden-hour-wt/ws9'].every(isRepo)).toBe(true);
		expect(['/work', '/work/golden-hour-other', '/work/other/golden-hour'].some(isRepo)).toBe(false);
	});

	it('scores only the two repo sessions', () => {
		expect(score(true).sessions.map((session) => session.label)).toEqual(['session-11111111', 'ws9-impl']);
	});
});

describe('session metrics', () => {
	it('scores the main session', () => {
		const { sessions } = score(true);
		const { github, ...metrics } = byLabel(sessions, 'session-11111111');
		expect(github).toEqual([]);
		expect(metrics).toEqual({
			label: 'session-11111111',
			durationMs: 10 * 60000,
			toolCalls: 9,
			byTool: { Read: 2, Grep: 2, Bash: 4, Edit: 1 },
			tokens: { input: 18, output: 13, cacheRead: 108, cacheWrite: 28 },
			firstRelevant: { path: 'src/app.ts', ms: 5 * 60000, calls: 6 },
			unusedReads: 1,
			failedCalls: 2,
			repeatedSearches: 1,
			retriedCommands: 1,
			prs: [],
			commits: ['abc1234'],
			running: false
		});
	});

	it('scores the EM session with GitHub metrics', () => {
		const em = byLabel(score(true).sessions, 'ws9-impl');
		expect(em).toMatchObject({
			durationMs: 10 * 60000,
			toolCalls: 5,
			byTool: { Read: 1, Bash: 3, Write: 1 },
			tokens: { input: 5, output: 5, cacheRead: 5, cacheWrite: 5 },
			firstRelevant: { path: 'scripts/tool.ts', ms: 2 * 60000, calls: 2 },
			unusedReads: 1,
			failedCalls: 0,
			prs: [7],
			commits: ['def5678', 'abc1234'],
			github: [{ number: 7, files: ['scripts/tool.ts'], ciRunsToGreen: 2, ciRuns: 3, reviewThreads: 2, reverts: 1 }]
		});
	});

	it('degrades gracefully without gh', () => {
		const result = score(false);
		const em = byLabel(result.sessions, 'ws9-impl');
		expect(result.githubAvailable).toBe(false);
		expect(em.github).toEqual([]);
		expect(em.commits).toEqual([]);
		expect(em.firstRelevant).toBeNull();
		expect(formatTable(result)).toContain('gh unavailable');
	});

	it('totals across sessions', () => {
		const { totals } = score(true);
		expect(totals).toMatchObject({
			durationMs: 20 * 60000,
			toolCalls: 14,
			tokens: { input: 23, output: 18, cacheRead: 113, cacheWrite: 33 },
			unusedReads: 2,
			failedCalls: 2,
			repeatedSearches: 1,
			retriedCommands: 1
		});
		expect(totals.byTool).toEqual({ Read: 3, Grep: 2, Bash: 7, Edit: 1, Write: 1 });
	});

	it('prints every column and a totals row', () => {
		const table = formatTable(score(true));
		const [header, ...rows] = table.split('\n');
		for (const column of ['session', 'dur', 'calls', 'cache r', '1st rel', 'unused reads', 'CI to green', 'reverts']) {
			expect(header).toContain(column);
		}
		expect(rows[0]).toMatch(/^session-11111111\s+10m\s+9\s+18\s+13\s+108\s+28\s+5m\/6\s+1\s+2\s+1\s+1\s+-/);
		expect(rows[1]).toMatch(/^ws9-impl\s+10m\s+5\s.*#7\s+2\s+2\s+1$/);
		expect(rows[2]).toMatch(/^total \(2\)\s+20m\s+14\s/);
	});
});

describe('running sessions', () => {
	const tenTen = Date.parse('2030-01-01T10:10:00Z');

	it('marks an unfinished session whose last record is recent and leaves it out of the totals', () => {
		const result = score(true, tenTen + runningWindowMs - 1);
		expect(byLabel(result.sessions, 'session-11111111').running).toBe(true);
		expect(byLabel(result.sessions, 'ws9-impl').running).toBe(false);
		expect(result.totals.toolCalls).toBe(5);
		const table = formatTable(result);
		expect(table).toMatch(/^session-11111111 \(running\)\s/m);
		expect(table).toMatch(/^total \(1\)\s+10m\s+5\s/m);
		expect(table).toContain('left out of the totals');
	});

	it('treats a session as finished once its last record is older than the window', () => {
		expect(score(true, tenTen + runningWindowMs).sessions.some((session) => session.running)).toBe(false);
	});

	it('treats a subagent whose meta says finished as finished even when recent', () => {
		const halfPast = Date.parse('2030-01-01T10:30:00Z');
		expect(byLabel(score(true, halfPast).sessions, 'ws9-impl').running).toBe(false);
	});
});

describe('helpers', () => {
	it('maps checkout and worktree paths to repo paths', () => {
		expect(repoPath('/work/golden-hour/src/a.ts', root)).toBe('src/a.ts');
		expect(repoPath('/work/golden-hour-wt/ws9/src/a.ts', root)).toBe('src/a.ts');
		expect(repoPath('./src/a.ts', root)).toBe('src/a.ts');
		expect(repoPath('/elsewhere/a.ts', root)).toBeNull();
	});

	it('keys commands by program and subcommand after cd', () => {
		expect(commandKey('cd /x && git push -u origin b')).toBe('git push');
		expect(commandKey('pnpm check')).toBe('pnpm check');
	});

	it('detects a path mentioned in a shell command', () => {
		expect(mentionsPath('sed -n 1,9p scripts/tool.ts', 'scripts/tool.ts')).toBe(true);
		expect(mentionsPath('cat /w/scripts/tool.ts | head', 'scripts/tool.ts')).toBe(true);
		expect(mentionsPath('cat scripts/tool.tsx', 'scripts/tool.ts')).toBe(false);
	});
});
