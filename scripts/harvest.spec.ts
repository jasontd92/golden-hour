// why: transcripts hold private messages and secrets, so every record here is synthetic, copied in shape only from ~/.claude/projects
import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
	checkBudget,
	checksIn,
	checkVocabulary,
	checkWindow,
	defaultWindow,
	publicBody,
	redact,
	reviewAllowed,
	reviewArgs,
	runFailed,
	scanTranscript,
	secretShaped,
	speakerOf,
	strayChanges,
	transcriptFiles,
	windowEvents,
	type Candidate,
	type Digest
} from './harvest.ts';
import { writeRecord } from './ledger.ts';
import type { Run } from './sessions/github.ts';

const scripts = (JSON.parse(readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
const vocab = checkVocabulary(scripts);
const window = { since: '2030-01-01', until: '2030-01-08' };

const cwd = '/work/golden-hour';
let clock = Date.parse('2030-01-02T10:00:00.000Z');
let ids = 0;
const tick = (at?: string) => (at ? Date.parse(at) : (clock += 60_000));
const iso = (ms: number) => new Date(ms).toISOString();
const base = (type: string, at: number) => ({ type, cwd, sessionId: 's', uuid: `u${++ids}`, timestamp: iso(at), entrypoint: 'cli' });

type Line = string;
function toolUse(name: string, input: Record<string, unknown>, at?: string): { id: string; line: Line } {
	const id = `toolu_${++ids}`;
	const line = JSON.stringify({ ...base('assistant', tick(at)), message: { id: `msg_${ids}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
	return { id, line };
}
const toolResult = (id: string, content: string, isError: boolean, at?: string): Line =>
	JSON.stringify({ ...base('user', tick(at)), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] }, toolUseResult: { stdout: content } });

function bash(command: string, output: string, isError = false, at?: string): Line[] {
	const call = toolUse('Bash', { command, description: 'synthetic' }, at);
	return [call.line, toolResult(call.id, output, isError, at && iso(Date.parse(at) + 5_000))];
}
function tool(name: string, input: Record<string, unknown>): Line[] {
	const call = toolUse(name, input);
	return [call.line, toolResult(call.id, 'ok', false)];
}
const human = (text: string, extra: Record<string, unknown> = {}, at?: string): Line =>
	JSON.stringify({ ...base('user', tick(at)), origin: { kind: 'human' }, promptSource: 'typed', message: { role: 'user', content: text }, ...extra });
const userTurn = (fields: Record<string, unknown>, content: unknown, at?: string): Line =>
	JSON.stringify({ ...base('user', tick(at)), message: { role: 'user', content }, ...fields });
const assistantText = (text: string): Line =>
	JSON.stringify({ ...base('assistant', tick()), message: { id: `msg_${++ids}`, role: 'assistant', content: [{ type: 'text', text }] } });

const FAIL_VITEST = ' FAIL  src/lib/sun.spec.ts > sunset > rounds to the minute\nAssertionError: expected 1 to be 2\n Test Files  1 failed | 3 passed (4)\n      Tests  1 failed | 41 passed (42)';
const PASS_VITEST = ' Test Files  4 passed (4)\n      Tests  42 passed (42)';
const FAIL_ESLINT = '/work/golden-hour/src/a.ts\n  3:7  error  x is unused  no-unused-vars\n\n✖ 1 problem (1 error, 0 warnings)';
const PASS_ESLINT = '';

const scan = (lines: Line[], name = 't1.jsonl', w = window) => scanTranscript(lines, name, vocab, w);
const only = (candidates: Candidate[], check: string) => {
	const found = candidates.filter((c) => c.check === check);
	expect(found).toHaveLength(1);
	return found[0]!;
};

describe('claim 1: check names come only from package.json scripts', () => {
	it('pnpm X and pnpm run X name X (rules out matching only one spelling)', () => {
		expect(checksIn('pnpm lint', vocab)).toEqual(['lint']);
		expect(checksIn('pnpm run lint', vocab)).toEqual(['lint']);
		expect(checksIn('cd /work/golden-hour && pnpm test:unit 2>&1 | tail -30', vocab)).toEqual(['test:unit']);
	});

	it('a script name is matched whole (rules out substring matching: typecheck is not check, test:unit is not test:e2e)', () => {
		expect(checksIn('pnpm typecheck', vocab)).toEqual(['typecheck']);
		expect(checksIn('pnpm test:e2e', vocab)).toEqual(['test:e2e']);
		expect(checksIn('pnpm check', vocab)).toEqual(['check']);
	});

	it('pnpm commands that are not package.json scripts name nothing (rules out inventing check names)', () => {
		expect(checksIn('pnpm test', vocab)).toEqual([]);
		expect(checksIn('pnpm install', vocab)).toEqual([]);
		expect(checksIn('pnpm exec vitest-fake', vocab)).toEqual([]);
		expect(checksIn('ls -la && git status', vocab)).toEqual([]);
	});

	it('a bare tool names the one script whose body runs it (rules out recognising only pnpm invocations)', () => {
		expect(checksIn('vitest --run src/lib', vocab)).toEqual(['test:unit']);
		expect(checksIn('npx vitest run', vocab)).toEqual(['test:unit']);
		expect(checksIn('./node_modules/.bin/eslint src', vocab)).toEqual(['lint']);
		expect(checksIn('npx playwright test e2e/home.e2e.ts', vocab)).toEqual(['test:e2e']);
		expect(checksIn('svelte-check --tsconfig ./tsconfig.json', vocab)).toEqual(['typecheck']);
		expect(checksIn('npx stryker run', vocab)).toEqual(['mutate']);
	});

	it('node scripts/x.ts names the one script that runs it (rules out ignoring node-run checks)', () => {
		expect(checksIn('node scripts/check-md.ts', vocab)).toEqual(['policy']);
		expect(checksIn('node scripts/harvest.ts --since 2030-01-01', vocab)).toEqual(['harvest']);
	});

	it('a tool or file two scripts share names neither (rules out picking the first owner)', () => {
		// why: plan-check.ts is run by both policy and plan:check, vite by dev/build/preview, ledger.ts by several
		expect(checksIn('node scripts/plan-check.ts', vocab)).toEqual([]);
		expect(checksIn('vite build', vocab)).toEqual([]);
		expect(checksIn('node scripts/ledger.ts agent x --tokens 1', vocab)).toEqual([]);
		const synthetic = checkVocabulary({ a: 'tsx one.ts', b: 'tsx two.ts', c: 'mocha' });
		expect(checksIn('tsx three.ts', synthetic)).toEqual([]);
		expect(checksIn('mocha', synthetic)).toEqual(['c']);
	});

	it('a command running several checks names each (rules out stopping at the first match)', () => {
		expect(checksIn('pnpm lint && pnpm test:unit', vocab)).toEqual(['lint', 'test:unit']);
		expect(checksIn('eslint . ; vitest --run', vocab)).toEqual(['lint', 'test:unit']);
	});

	it('a command mixing a pnpm script and a bare tool names both (rules out consulting tools only when no pnpm script matched)', () => {
		expect(checksIn('pnpm lint && vitest --run', vocab)).toEqual(['lint', 'test:unit']);
	});
});

describe('claim 2: a check run failed on an error result or failure output', () => {
	it('an error tool result is a failure whatever its text (rules out reading output only)', () => {
		expect(runFailed(true, 'done')).toBe(true);
	});

	it('failure output counts even when a pipe hid the exit code (rules out trusting is_error alone)', () => {
		expect(runFailed(false, FAIL_VITEST)).toBe(true);
		expect(runFailed(false, '✖ 12 problems (12 errors, 0 warnings)')).toBe(true);
		expect(runFailed(false, ' ELIFECYCLE  Command failed with exit code 1.')).toBe(true);
		expect(runFailed(false, 'Exit code 2\nsomething')).toBe(true);
		expect(runFailed(false, 'Found 3 errors in 2 files.')).toBe(true);
		expect(runFailed(false, ' Tests  10 failed | 2 passed (12)')).toBe(true);
	});

	it('"0 failed" style output and clean passes are not failures (rules out matching the word "failed"/"errors" alone)', () => {
		expect(runFailed(false, PASS_VITEST)).toBe(false);
		expect(runFailed(false, ' Tests  0 failed | 42 passed (42)')).toBe(false);
		expect(runFailed(false, 'svelte-check found 0 errors and 0 warnings')).toBe(false);
		expect(runFailed(false, '✖ 0 problems')).toBe(false);
		expect(runFailed(false, 'Exit code 0')).toBe(false);
		expect(runFailed(false, '')).toBe(false);
	});
});

describe('claim 3: a failure later followed by a pass is a candidate, classified by what happened between', () => {
	it('an Edit between failure and pass makes it fixed-by-edit, listing the file (rules out ignoring edits)', () => {
		const result = scan([
			...bash('pnpm test:unit', FAIL_VITEST, true),
			...tool('Edit', { file_path: `${cwd}/src/lib/sun.ts`, old_string: 'a', new_string: 'b' }),
			...bash('pnpm test:unit', PASS_VITEST)
		]);
		const c = only(result.candidates, 'test:unit');
		expect(c.kind).toBe('fixed-by-edit');
		expect(c.editedFiles).toEqual([`${cwd}/src/lib/sun.ts`]);
		expect(c.passedAt).not.toBeNull();
		expect(c.failedCommand).toBe('pnpm test:unit');
		expect(c.transcript).toBe('t1.jsonl');
	});

	it.each([
		['Write', { file_path: `${cwd}/src/a.ts`, content: 'x' }],
		['MultiEdit', { file_path: `${cwd}/src/a.ts`, edits: [] }],
		['NotebookEdit', { notebook_path: `${cwd}/notes/a.ipynb`, new_source: 'x' }]
	])('a %s between failure and pass makes it fixed-by-edit (rules out recognising only Edit)', (name, input) => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true), ...tool(name, input), ...bash('pnpm lint', PASS_ESLINT)]);
		expect(only(result.candidates, 'lint').kind).toBe('fixed-by-edit');
	});

	it.each([
		["echo 'export const x = 1;' > src/a.ts"],
		['printf "x" >> src/a.ts'],
		["sed -i '' 's/a/b/' src/a.ts"],
		['git checkout -- src/a.ts'],
		['git restore src/a.ts']
	])('a shell write (%s) between failure and pass makes it fixed-by-edit (rules out treating shell file changes as nothing changed)', (command) => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true), ...bash(command, ''), ...bash('pnpm lint', PASS_ESLINT)]);
		expect(only(result.candidates, 'lint').kind).toBe('fixed-by-edit');
	});

	it('the same command passing with nothing changed is passed-on-rerun, even after read-only shell commands (rules out counting every Bash call as a change)', () => {
		const result = scan([
			...bash('pnpm test:unit', FAIL_VITEST, true),
			...bash('git status && git diff', ''),
			...bash('grep -rn sunset src 2>&1 | head -20', 'src/lib/sun.ts:1:sunset'),
			...tool('Read', { file_path: `${cwd}/src/lib/sun.ts` }),
			...bash('pnpm test:unit', PASS_VITEST)
		]);
		const c = only(result.candidates, 'test:unit');
		expect(c.kind).toBe('passed-on-rerun');
		expect(c.editedFiles).toEqual([]);
	});

	it('a different passing command with nothing changed is passed-other-command, not a rerun (rules out calling it a flake)', () => {
		const result = scan([...bash('pnpm test:unit 2>&1 | tail -5', FAIL_VITEST), ...bash('pnpm test:unit src/lib/sun.spec.ts', PASS_VITEST)]);
		const c = only(result.candidates, 'test:unit');
		expect(c.kind).toBe('passed-other-command');
		expect(c.failedCommand).toBe('pnpm test:unit 2>&1 | tail -5');
		expect(c.passedCommand).toBe('pnpm test:unit src/lib/sun.spec.ts');
	});

	it('an edit outranks a different command: edited then passed differently is fixed-by-edit (rules out preferring passed-other-command)', () => {
		const result = scan([
			...bash('pnpm test:unit', FAIL_VITEST, true),
			...tool('Edit', { file_path: `${cwd}/src/a.ts`, old_string: 'a', new_string: 'b' }),
			...bash('vitest --run src/a.spec.ts', PASS_VITEST)
		]);
		expect(only(result.candidates, 'test:unit').kind).toBe('fixed-by-edit');
	});

	it('a failure with no pass after it is never-passed (rules out dropping unresolved failures, the costliest miss)', () => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true), assistantText('Lint fails on an unrelated file; leaving it.')]);
		const c = only(result.candidates, 'lint');
		expect(c.kind).toBe('never-passed');
		expect(c.passedAt).toBeNull();
		expect(c.passedCommand).toBeNull();
	});

	it('repeated failures before one pass are one candidate counting the failed runs (rules out one candidate per red run)', () => {
		const result = scan([
			...bash('pnpm lint', FAIL_ESLINT, true),
			...bash('pnpm lint', FAIL_ESLINT, true),
			...tool('Edit', { file_path: `${cwd}/src/a.ts`, old_string: 'a', new_string: 'b' }),
			...bash('pnpm lint', PASS_ESLINT)
		]);
		const c = only(result.candidates, 'lint');
		expect(c.failedRuns).toBe(2);
	});

	it('passing runs alone produce no candidates, but are recorded as check runs (rules out inventing catches)', () => {
		const result = scan([...bash('pnpm lint', PASS_ESLINT), ...bash('pnpm test:unit', PASS_VITEST)]);
		expect(result.candidates).toEqual([]);
		expect(result.checkRuns.map((r) => [r.check, r.failed])).toEqual([
			['lint', false],
			['test:unit', false]
		]);
	});

	it('a failed run hidden by a pipe is still a failed run (rules out trusting is_error in the scan)', () => {
		const result = scan([...bash('pnpm test:unit | tail -3', FAIL_VITEST, false)]);
		expect(result.checkRuns[0]?.failed).toBe(true);
		expect(only(result.candidates, 'test:unit').kind).toBe('never-passed');
	});

	it('failures are tracked per check: another check passing does not end it (rules out one open failure per transcript)', () => {
		const result = scan([...bash('pnpm test:unit', FAIL_VITEST, true), ...bash('pnpm lint', PASS_ESLINT)]);
		expect(only(result.candidates, 'test:unit').kind).toBe('never-passed');
		expect(result.candidates.filter((c) => c.check === 'lint')).toEqual([]);
	});

	it('failures are tracked per transcript: a pass in another transcript does not end it (rules out state leaking across scans)', () => {
		const first = scan([...bash('pnpm lint', FAIL_ESLINT, true)], 'a.jsonl');
		const second = scan([...bash('pnpm lint', PASS_ESLINT)], 'b.jsonl');
		expect(only(first.candidates, 'lint').kind).toBe('never-passed');
		expect(second.candidates).toEqual([]);
	});

	it('a passing composite script ends open failures of the scripts it runs (rules out never-passed for a test fixed and proven by pnpm check)', () => {
		const result = scan([
			...bash('pnpm test:unit', FAIL_VITEST, true),
			...tool('Edit', { file_path: `${cwd}/src/a.ts`, old_string: 'a', new_string: 'b' }),
			...bash('pnpm check', `${PASS_ESLINT}\n${PASS_VITEST}`)
		]);
		const c = only(result.candidates, 'test:unit');
		expect(c.kind).toBe('fixed-by-edit');
		expect(c.passedCommand).toBe('pnpm check');
	});

	it('a composite only ends failures of its own parts, and a failing composite ends nothing (rules out any pass closing any failure)', () => {
		const result = scan([
			...bash('pnpm test:e2e', 'Error: 1 failed', true),
			...bash('pnpm test:unit', FAIL_VITEST, true),
			...bash('pnpm check', ' ELIFECYCLE  Command failed with exit code 1.', true),
			...bash('pnpm check', PASS_VITEST)
		]);
		expect(only(result.candidates, 'test:e2e').kind).toBe('never-passed');
		const unit = only(result.candidates, 'test:unit');
		expect(unit.kind).not.toBe('never-passed');
		expect(unit.passedCommand).toBe('pnpm check');
	});

	it('claimBefore is the last commit before the failure, not one after it (rules out the first or the latest claim in the session)', () => {
		const result = scan([
			...bash("git commit -m 'feat: one'", '[b 1111111] feat: one', false, '2030-01-02T09:00:00.000Z'),
			...bash("git commit -m 'feat: two'", '[b 2222222] feat: two', false, '2030-01-02T09:10:00.000Z'),
			...bash('pnpm lint', FAIL_ESLINT, true, '2030-01-02T09:20:00.000Z'),
			...bash('git push', 'ok', false, '2030-01-02T09:30:00.000Z')
		]);
		const claim = only(result.candidates, 'lint').claimBefore;
		expect(claim).toMatch(/commit/);
		expect(claim).toContain('2030-01-02T09:10:00');
		expect(claim).not.toContain('09:30');
	});

	it.each([
		['git push -u origin feature', /push/],
		['gh pr create --title t --body b', /create|pr/i],
		['gh pr merge 12 --squash', /merge|pr/i]
	])('claimBefore records %s (rules out recognising commits only)', (command, kind) => {
		const result = scan([...bash(command, 'ok', false, '2030-01-02T08:00:00.000Z'), ...bash('pnpm lint', FAIL_ESLINT, true, '2030-01-02T08:30:00.000Z')]);
		const claim = only(result.candidates, 'lint').claimBefore;
		expect(claim).toMatch(kind);
		expect(claim).toContain('2030-01-02T08:00:00');
	});

	it('claimBefore records a hand-back to another agent (rules out ignoring agents that report done by message)', () => {
		const handBack = toolUse('SendMessage', { to: 'lead', message: 'done, tests green' }, '2030-01-02T07:00:00.000Z');
		const result = scan([handBack.line, toolResult(handBack.id, 'sent', false, '2030-01-02T07:00:01.000Z'), ...bash('pnpm lint', FAIL_ESLINT, true, '2030-01-02T07:30:00.000Z')]);
		expect(only(result.candidates, 'lint').claimBefore).toContain('2030-01-02T07:00:00');
	});

	it('claimBefore is null when nothing was claimed before the failure (rules out a placeholder claim)', () => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true), ...bash("git commit -m 'x'", 'ok')]);
		expect(only(result.candidates, 'lint').claimBefore).toBeNull();
	});

	it('a failing command that ran several checks opens each, recording the others as sharedWith (rules out blaming one check for a shared red run)', () => {
		const result = scan([...bash('pnpm lint && pnpm test:unit', FAIL_ESLINT, true), ...bash('pnpm lint', PASS_ESLINT), ...bash('pnpm test:unit', PASS_VITEST)]);
		expect(only(result.candidates, 'lint').sharedWith).toEqual(['test:unit']);
		expect(only(result.candidates, 'test:unit').sharedWith).toEqual(['lint']);
		const solo = scan([...bash('pnpm lint', FAIL_ESLINT, true)]);
		expect(only(solo.candidates, 'lint').sharedWith).toEqual([]);
	});

	it('the candidate excerpt keeps the failure lines (rules out an empty or head-of-output excerpt)', () => {
		const result = scan([...bash('pnpm test:unit', `${'noise line\n'.repeat(200)}${FAIL_VITEST}`, true)]);
		expect(only(result.candidates, 'test:unit').excerpt).toContain('AssertionError: expected 1 to be 2');
	});
});

describe('claim 4: only runs, candidates and messages inside [since, until) are reported', () => {
	const w = { since: '2030-01-02', until: '2030-01-03' };

	it('a run at since is in, a run at until is out (rules out an inclusive or shifted window)', () => {
		const result = scan([...bash('pnpm lint', PASS_ESLINT, false, '2030-01-02T00:00:00.000Z'), ...bash('pnpm test:unit', PASS_VITEST, false, '2030-01-03T00:00:00.000Z')], 't', w);
		expect(result.checkRuns.map((r) => r.check)).toEqual(['lint']);
	});

	it('a failure before the window is not a candidate even if its pass is inside (rules out dating candidates by the pass)', () => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true, '2030-01-01T23:00:00.000Z'), ...bash('pnpm lint', PASS_ESLINT, false, '2030-01-02T01:00:00.000Z')], 't', w);
		expect(result.candidates).toEqual([]);
		expect(result.checkRuns.map((r) => r.at.slice(0, 10))).toEqual(['2030-01-02']);
	});

	it('a failure inside the window is a candidate even if its pass came after (rules out requiring the pass in the window)', () => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true, '2030-01-02T23:00:00.000Z'), ...bash('pnpm lint', PASS_ESLINT, false, '2030-01-03T01:00:00.000Z')], 't', w);
		expect(only(result.candidates, 'lint').kind).toBe('passed-on-rerun');
	});

	it('a failure after the window is not a candidate (rules out reporting everything in the file)', () => {
		const result = scan([...bash('pnpm lint', FAIL_ESLINT, true, '2030-01-04T10:00:00.000Z')], 't', w);
		expect(result.candidates).toEqual([]);
		expect(result.checkRuns).toEqual([]);
	});

	it('messages outside the window are dropped (rules out unfiltered messages)', () => {
		const result = scan([human('before', {}, '2030-01-01T12:00:00.000Z'), human('during', {}, '2030-01-02T12:00:00.000Z'), human('after', {}, '2030-01-03T12:00:00.000Z')], 't', w);
		expect(result.messages.map((m) => m.text)).toEqual(['during']);
	});
});

describe('claim 5: messages are human turns only, labelled you / maybe-you', () => {
	const speakers = (lines: Line[]) => scan(lines).messages.map((m) => [m.speaker, m.text]);

	it('a typed human turn is you; a turn without an origin field is maybe-you (rules out treating old transcripts as certain or as absent)', () => {
		expect(speakers([human('please fix the sunset rounding'), userTurn({}, 'older transcript prompt')])).toEqual([
			['you', 'please fix the sunset rounding'],
			['maybe-you', 'older transcript prompt']
		]);
	});

	it('a human turn whose content is text blocks is included (rules out string content only)', () => {
		expect(speakers([userTurn({ origin: { kind: 'human' }, promptSource: 'typed' }, [{ type: 'text', text: 'block prompt' }])])).toEqual([['you', 'block prompt']]);
	});

	it.each([
		['a tool result', userTurn({ origin: { kind: 'human' } }, [{ type: 'tool_result', tool_use_id: 'x', content: 'Exit code 1', is_error: true }])],
		['a meta turn', userTurn({ isMeta: true }, 'Caveat: meta')],
		['a meta turn with human origin', userTurn({ isMeta: true, origin: { kind: 'human' } }, 'expanded skill body')],
		['a compact summary', userTurn({ isCompactSummary: true }, 'This session is being continued from a previous conversation')],
		['a compact summary with plain text', userTurn({ isCompactSummary: true }, 'Summary: the user asked for x')],
		['a subagent (sidechain) turn', userTurn({ isSidechain: true, origin: { kind: 'human' } }, 'Explore the repo')],
		['an sdk entrypoint turn', userTurn({ entrypoint: 'sdk-cli', origin: { kind: 'human' } }, 'scripted prompt')],
		['a peer turn', userTurn({ origin: { kind: 'peer' } }, 'peer says hi')],
		['a task notification turn', userTurn({ origin: { kind: 'task-notification' } }, '<task-notification>done</task-notification>')],
		['an agent hand-back without origin', userTurn({}, 'Another Claude session sent a message: all done')],
		['a task notification without origin', userTurn({}, '<task-notification><status>completed</status></task-notification>')],
		['an interrupt marker', userTurn({}, '[Request interrupted by user for tool use]')],
		['an empty turn', human('   ')]
	])('%s is excluded (rules out counting non-human turns as your words)', (_label, line) => {
		expect(speakers([line])).toEqual([]);
	});

	it('assistant text is never a message (rules out reading every text block)', () => {
		expect(speakers([assistantText('I fixed it')])).toEqual([]);
	});

	it("a session whose first human-origin prompt is an agent persona turns its you into maybe-you (rules out trusting origin in agent-driven terminals)", () => {
		const result = scan([human("You are agent 'ping'. Wait for messages and reply."), human('looks good, merge it')]);
		expect(result.agentDriven).toBe(true);
		expect(result.messages.map((m) => m.speaker)).not.toContain('you');
		expect(result.messages.map((m) => [m.speaker, m.text])).toContainEqual(['maybe-you', 'looks good, merge it']);
	});

	it('a persona appearing after a normal first prompt does not demote the session (rules out scanning every prompt for personas)', () => {
		const result = scan([human('fix the header spacing'), human("you are agent 'x' in the story I'm writing")]);
		expect(result.agentDriven).toBe(false);
		expect(result.messages[0]).toMatchObject({ speaker: 'you', text: 'fix the header spacing' });
	});

	it('speakerOf agrees directly on the record shapes (rules out the scan and the classifier disagreeing)', () => {
		expect(speakerOf({ type: 'user', origin: { kind: 'human' }, promptSource: 'typed', entrypoint: 'cli' }, 'hi')).toBe('you');
		expect(speakerOf({ type: 'user' }, 'hi')).toBe('maybe-you');
		expect(speakerOf({ type: 'user', origin: { kind: 'peer' } }, 'hi')).toBeNull();
		expect(speakerOf({ type: 'user', isSidechain: true, origin: { kind: 'human' } }, 'hi')).toBeNull();
		expect(speakerOf({ type: 'user', entrypoint: 'sdk-cli', origin: { kind: 'human' } }, 'hi')).toBeNull();
		expect(speakerOf({ type: 'assistant' }, 'hi')).toBeNull();
	});
});

// why: built at runtime so no literal secret is committed and push protection has nothing to flag
const fake = {
	anthropic: ['sk', 'ant', 'api03', 'Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0LzXcVbNm'].join('-'),
	githubClassic: 'gh' + 'p_' + 'Ab12Cd34Ef56Gh78Ij90Kl12Mn34Op56Qr78',
	githubFine: 'github' + '_pat_' + '11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz0123456789',
	aws: 'AK' + 'IA' + 'Q7X2M9V4K1B8N3P6',
	jwt: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRvZSJ9', 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV'].join('.'),
	bearer: 'q8Zr2Lm5Tn7Wp1Xs4Vb6Yc9Kd3Hf0Ga',
	token: 'tKn' + '0aB1cD2eF3gH4',
	password: 'hunt' + 'er2-Correct-Horse',
	urlPassword: 'pa55' + 'w0rdInUrl'
};

describe('claim 6: secrets are redacted from excerpts, commands and messages', () => {
	it.each([
		['an Anthropic key', `ANTHROPIC said ${fake.anthropic} is invalid`, fake.anthropic],
		['a classic GitHub token', `remote: ${fake.githubClassic}`, fake.githubClassic],
		['a fine-grained GitHub token', `using ${fake.githubFine}`, fake.githubFine],
		['an AWS access key id', `aws key ${fake.aws} rejected`, fake.aws],
		['a JWT', `cookie=${fake.jwt}`, fake.jwt],
		['a bearer token', `Authorization: Bearer ${fake.bearer}`, fake.bearer],
		['a token=value pair', `GH_TOKEN=${fake.token} gh pr list`, fake.token],
		['a password: value pair', `password: ${fake.password}`, fake.password],
		['a password in a URL', `git clone https://jane:${fake.urlPassword}@example.com/repo.git`, fake.urlPassword]
	])('redact removes %s (rules out a pattern list missing that kind)', (_label, text, secret) => {
		const out = redact(text);
		expect(out).not.toContain(secret);
		expect(out.length).toBeGreaterThan(0);
	});

	it('redact keeps ordinary text: commands, shas, prose about tokens (rules out redacting so much the digest is useless)', () => {
		const text = 'pnpm test:unit failed at commit 9c3002d1f0e5a6b7c8d9e0f1a2b3c4d5e6f7a8b9; the token budget is fine; see https://github.com/o/r/pull/12';
		expect(redact(text)).toBe(text);
	});

	it('redact keeps the context around a secret (rules out blanking the whole line)', () => {
		expect(redact(`Authorization: Bearer ${fake.bearer}`)).toContain('Authorization: Bearer');
		expect(redact(`git clone https://jane:${fake.urlPassword}@example.com/repo.git`)).toContain('example.com/repo.git');
	});

	it('scanTranscript redacts secrets in candidate excerpts, commands and messages (rules out redacting only one field)', () => {
		const result = scan([
			human(`my key is ${fake.anthropic}, use it`),
			...bash(`GH_TOKEN=${fake.token} pnpm lint`, `${FAIL_ESLINT}\nerror: bad credentials ${fake.githubClassic}`, true)
		]);
		const dump = JSON.stringify(result);
		for (const secret of [fake.anthropic, fake.token, fake.githubClassic]) expect(dump).not.toContain(secret);
		expect(only(result.candidates, 'lint').failedCommand).toContain('pnpm lint');
		expect(result.messages).toHaveLength(1);
	});
});

describe('claim 7: transcriptFiles reads the repo, its -wt- worktrees and the parent folder only', () => {
	const tmp = mkdtempSync(path.join(os.tmpdir(), 'harvest-oracle-'));
	afterAll(() => rmSync(tmp, { recursive: true, force: true }));
	const root = '/work/golden-hour';
	const enc = (dir: string) => dir.replace(/[^A-Za-z0-9]/g, '-');
	const since = Date.parse('2030-01-01T00:00:00.000Z');
	const fresh = new Date('2030-01-03T00:00:00.000Z');
	const stale = new Date('2029-12-20T00:00:00.000Z');
	const put = (rel: string, body: string, mtime = fresh) => {
		const file = path.join(tmp, rel);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, body);
		utimesSync(file, mtime, mtime);
		return file;
	};
	const mention = JSON.stringify({ type: 'user', cwd: root, timestamp: '2030-01-02T00:00:00.000Z', message: { role: 'user', content: 'x' } }) + '\n';
	const worktreeMention = JSON.stringify({ type: 'user', cwd: `${root}-wt/feature`, message: { role: 'user', content: 'x' } }) + '\n';
	const unrelated = JSON.stringify({ type: 'user', cwd: '/work/other', message: { role: 'user', content: 'x' } }) + '\n';

	const expected = [
		put(`${enc(root)}/a.jsonl`, mention),
		put(`${enc(root)}/a/subagents/agent-1.jsonl`, mention),
		put(`${enc(root)}-wt-feature/b.jsonl`, worktreeMention),
		put(`${enc('/work')}/sprint.jsonl`, mention),
		put(`${enc('/work')}/sprint/subagents/agent-2.jsonl`, mention)
	];
	put(`${enc(root)}/modified-before-window.jsonl`, mention, stale);
	put(`${enc('/work')}/parent-folder-not-mentioning-repo.jsonl`, unrelated);
	put(`${enc('/work/other')}/unrelated-project-mentioning-path.jsonl`, mention);
	put(`${enc('/work/golden-hour-old')}/sibling-repo-sharing-prefix.jsonl`, mention);
	put(`${enc(root)}/a/subagents/agent-1.meta.json`, mention);

	it('keeps exactly the recent repo-mentioning transcripts, recursively, in those folders (rules out a prefix match, a non-recursive read, or no mtime/mention filter)', () => {
		expect([...transcriptFiles(tmp, root, since)].sort()).toEqual([...expected].sort());
	});

	it('tolerates a trailing slash on the root and a missing projects folder (rules out crashing the weekly run)', () => {
		expect([...transcriptFiles(tmp, `${root}/`, since)].sort()).toEqual([...expected].sort());
		expect(transcriptFiles(path.join(tmp, 'missing'), root, since)).toEqual([]);
	});
});

describe('claim 8: windowEvents reports fix/revert commits on main, merged PRs and non-PR failed runs', () => {
	const sep = '\x1f';
	const log = [
		['a1', '2030-01-02T10:00:00Z', 'fix: sunset rounds down'],
		['a2', '2030-01-02T11:00:00Z', 'fix(ui): header overlap'],
		['a3', '2030-01-02T12:00:00Z', 'revert: drop the canary'],
		['a4', '2030-01-02T13:00:00Z', 'Revert "feat: new map"'],
		['a5', '2030-01-02T14:00:00Z', 'feat: add tides'],
		['a6', '2030-01-02T15:00:00Z', 'chore: fix typo in docs'],
		['a7', '2030-01-02T16:00:00Z', 'Merge pull request #12 from o/fix-x']
	]
		.map((parts) => parts.join(sep))
		.join('\n');
	const prs = [
		{ number: 12, title: 'fix: x', mergedAt: '2030-01-02T16:00:00Z' },
		{ number: 13, title: 'feat: y', mergedAt: '2030-01-03T16:00:00Z' }
	];
	const runs = [
		{ databaseId: 1, workflowName: 'CI', headBranch: 'main', event: 'push', headSha: 's1', createdAt: '2030-01-02T10:00:00Z' },
		{ databaseId: 2, workflowName: 'CI', headBranch: 'feature', event: 'pull_request', headSha: 's2', createdAt: '2030-01-02T10:00:00Z' },
		{ databaseId: 3, workflowName: 'Canary', headBranch: 'main', event: 'schedule', headSha: 's3', createdAt: '2030-01-02T10:00:00Z' },
		{ databaseId: 4, workflowName: 'Deploy', headBranch: 'feature', event: 'workflow_dispatch', headSha: 's4', createdAt: '2030-01-02T10:00:00Z' }
	];
	const calls: string[][] = [];
	const fakeRun =
		(gh: boolean): Run =>
		(cmd, args) => {
			calls.push([cmd, ...args]);
			if (cmd === 'git' && args[0] === 'log') return log;
			if (cmd !== 'gh' || !gh) return null;
			if (args[0] === 'pr') return JSON.stringify(prs);
			if (args[0] === 'run') return JSON.stringify(runs);
			return null;
		};

	it('keeps fix and revert commits only (rules out every commit, or any subject containing "fix")', () => {
		expect(windowEvents(fakeRun(true), window).fixCommits.map((c) => c.sha)).toEqual(['a1', 'a2', 'a3', 'a4']);
	});

	it('asks git for main within the window (rules out reading the local branch or all history)', () => {
		calls.length = 0;
		windowEvents(fakeRun(true), window);
		const git = calls.find(([cmd]) => cmd === 'git')!.join(' ');
		expect(git).toMatch(/\bmain\b/);
		expect(git).toContain(window.since);
		expect(git).toContain(window.until);
		const ghCalls = calls.filter(([cmd]) => cmd === 'gh').map((c) => c.join(' '));
		expect(ghCalls.length).toBeGreaterThanOrEqual(2);
		for (const call of ghCalls) expect(call).toContain(window.since);
	});

	it('lists merged PRs (rules out dropping PR context)', () => {
		expect(windowEvents(fakeRun(true), window).mergedPrs).toEqual([
			{ number: 12, title: 'fix: x', mergedAt: '2030-01-02T16:00:00Z' },
			{ number: 13, title: 'feat: y', mergedAt: '2030-01-03T16:00:00Z' }
		]);
	});

	it('keeps failed runs on main or from non-PR events, dropping PR runs on branches (rules out every red PR run, which CI already counts)', () => {
		const events = windowEvents(fakeRun(true), window);
		expect(events.failedRuns.map((r) => r.id).sort()).toEqual([1, 3, 4]);
		expect(events.failedRuns.find((r) => r.id === 3)).toMatchObject({ workflow: 'Canary', branch: 'main', event: 'schedule', sha: 's3' });
		expect(events.github).toBe(true);
	});

	it('github is false when gh fails, and git commits still come through (rules out a silent empty GitHub section)', () => {
		const events = windowEvents(fakeRun(false), window);
		expect(events.github).toBe(false);
		expect(events.mergedPrs).toEqual([]);
		expect(events.failedRuns).toEqual([]);
		expect(events.fixCommits).toHaveLength(4);
	});

	it('github is false when gh returns something that is not JSON (rules out crashing on an auth prompt)', () => {
		const events = windowEvents((cmd) => (cmd === 'gh' ? 'To get started with GitHub CLI, please run: gh auth login' : ''), window);
		expect(events.github).toBe(false);
	});
});

describe('defaultWindow covers the last seven days including today', () => {
	it('ends at tomorrow (exclusive) and starts seven days earlier (rules out a window that misses today)', () => {
		expect(defaultWindow(new Date('2026-11-25T15:00:00.000Z'))).toEqual({ since: '2026-11-19', until: '2026-11-26' });
		expect(defaultWindow(new Date('2026-11-25T23:59:00.000Z'))).toEqual({ since: '2026-11-19', until: '2026-11-26' });
		expect(defaultWindow(new Date('2026-03-01T00:00:00.000Z'))).toEqual({ since: '2026-02-23', until: '2026-03-02' });
	});
});

describe('claim 9: the weekly review session is sandboxed', () => {
	const projects = '/home/u/.claude/projects';
	const args = reviewArgs(window, projects, 7.5);
	const valueOf = (flag: string) => args[args.indexOf(flag) + 1];
	const listOf = (flag: string) => {
		const start = args.indexOf(flag);
		expect(start).toBeGreaterThanOrEqual(0);
		const rest = args.slice(start + 1);
		const end = rest.findIndex((a) => a.startsWith('--'));
		return (end === -1 ? rest : rest.slice(0, end)).flatMap((a) => a.split(/[,\s]+(?![^(]*\))/)).filter(Boolean);
	};

	it('runs as the harvester agent, non-interactively, without session persistence (rules out the default agent or a saved session polluting next week)', () => {
		expect(args).toContain('-p');
		expect(valueOf('--agent')).toBe('harvester');
		expect(args).toContain('--no-session-persistence');
	});

	it('is capped at the given budget (rules out an uncapped or hardcoded budget)', () => {
		expect(valueOf('--max-budget-usd')).toBe('7.5');
		expect(reviewArgs(window, projects, 3)[reviewArgs(window, projects, 3).indexOf('--max-budget-usd') + 1]).toBe('3');
	});

	it('adds the transcripts folder (rules out a session that cannot read the evidence)', () => {
		expect(valueOf('--add-dir')).toBe(projects);
	});

	it('denies git push/commit, PR create/merge/edit, web and subagents (rules out a review that can ship or merge its own findings)', () => {
		const denied = listOf('--disallowedTools').join(' ');
		for (const pattern of [/git push/, /git commit/, /gh pr create/, /gh pr merge/, /gh pr edit/, /WebFetch/, /WebSearch/, /\b(Agent|Task)\b/]) expect(denied).toMatch(pattern);
	});

	it('never bypasses permissions or allows a denied tool (rules out a deny list made moot)', () => {
		expect(args).not.toContain('--dangerously-skip-permissions');
		expect(args.join(' ')).not.toMatch(/bypassPermissions/);
		const allowed = args.includes('--allowedTools') ? listOf('--allowedTools') : [];
		for (const tool of ['Agent', 'Task', 'WebFetch', 'WebSearch']) expect(allowed).not.toContain(tool);
	});

	it('names the window in the prompt (rules out a session that does not know which week to judge)', () => {
		const prompt = valueOf('-p')!;
		expect(prompt).toContain(window.since);
		expect(prompt).toContain(window.until);
	});
});

describe('claim 10: checkWindow accepts only real YYYY-MM-DD dates with since before until', () => {
	it.each([
		[{ since: '2026-11-19', until: '2026-11-26' }],
		[{ since: '2028-02-29', until: '2028-03-01' }],
		[{ since: '2026-12-31', until: '2027-01-01' }]
	])('accepts %o and returns it (rules out rejecting leap days or year ends)', (w) => {
		expect(checkWindow(w)).toEqual(w);
	});

	it.each([
		['an impossible day', { since: '2026-02-30', until: '2026-03-05' }],
		['Feb 29 in a non-leap year', { since: '2027-02-29', until: '2027-03-05' }],
		['month 13', { since: '2026-11-01', until: '2026-13-01' }],
		['day 32', { since: '2026-01-32', until: '2026-02-05' }],
		['an unpadded date', { since: '2026-1-05', until: '2026-01-12' }],
		['a word', { since: 'yesterday', until: '2026-01-12' }],
		['an empty value', { since: '', until: '2026-01-12' }],
		['a timestamp, not a date', { since: '2026-01-05T00:00:00Z', until: '2026-01-12' }],
		['trailing text', { since: '2026-01-05; rm -rf /', until: '2026-01-12' }],
		['since equal to until', { since: '2026-01-05', until: '2026-01-05' }],
		['since after until', { since: '2026-01-12', until: '2026-01-05' }],
		['since after until across a year', { since: '2027-01-01', until: '2026-12-31' }]
	])('throws on %s (rules out a shape-only regex, Date rolling 02-30 over to 03-02, or no order check)', (_label, w) => {
		expect(() => checkWindow(w)).toThrow();
	});
});

// why: built at runtime so no literal secret is committed and push protection has nothing to flag
const openai = {
	project: ['sk', 'proj', 'Q3vX9b_Lm2Rt8Yw4Np6Ks1Df7Gh0Jz5', 'T3Blbk' + 'FJ', 'Hk2Lp9Wq4Xr7Ts1Vu8Yb3Zc6Nd0Mf5_aB'].join('-'),
	legacy: 'sk-' + 'Wq4Xr7Ts1Vu8Yb3Z' + 'T3Blbk' + 'FJ' + 'c6Nd0Mf5aBHk2Lp9Q3vX9bLm',
	awsSecret: 'wJalr' + 'XUtnFEMI/K7MDENG/bPxRfi' + 'CY9q2Lk8Zt',
	keyValue: 'kV' + '7pQ2xL9mR4tW8z',
	tokenValue: 'nT' + '3kR8vB1qZ6yH0s',
	secretValue: 'cS' + '5hJ1nM7wE2rT9u'
};

describe('claim 11: redact removes OpenAI keys and KEY/SECRET/TOKEN-named assignments', () => {
	it.each([
		['an OpenAI project key', `OpenAI rejected ${openai.project} (401)`, openai.project],
		['a legacy OpenAI key', `curl -H "x: ${openai.legacy}" https://api.example.com`, openai.legacy],
		['AWS_SECRET_ACCESS_KEY=…', `AWS_SECRET_ACCESS_KEY=${openai.awsSecret} aws s3 ls`, openai.awsSecret],
		['export AWS_SECRET_ACCESS_KEY="…"', `export AWS_SECRET_ACCESS_KEY="${openai.awsSecret}"`, openai.awsSecret],
		['OPENAI_API_KEY=…', `OPENAI_API_KEY=${openai.keyValue} node run.js`, openai.keyValue],
		['a KEY-named variable without "api" or "access" (DEPLOY_KEY=…)', `DEPLOY_KEY=${openai.keyValue} ./deploy.sh`, openai.keyValue],
		['a KEY-named variable (STRIPE_SIGNING_KEY: …)', `STRIPE_SIGNING_KEY: ${openai.keyValue}`, openai.keyValue],
		['a TOKEN-named variable (NPM_TOKEN=…)', `NPM_TOKEN=${openai.tokenValue} pnpm publish`, openai.tokenValue],
		['a SECRET-named variable (CLIENT_SECRET=…)', `CLIENT_SECRET=${openai.secretValue}`, openai.secretValue]
	])('redact removes %s (rules out matching only sk-ant- keys or only api/access-prefixed names)', (_label, text, secret) => {
		const out = redact(text);
		expect(out).not.toContain(secret);
		expect(out.length).toBeGreaterThan(0);
	});

	it('keeps the variable name so the digest still says which secret was there (rules out blanking the whole assignment or line)', () => {
		const out = redact(`AWS_SECRET_ACCESS_KEY=${openai.awsSecret} aws s3 ls`);
		expect(out).toContain('AWS_SECRET_ACCESS_KEY');
		expect(out).toContain('aws s3 ls');
	});

	it('keeps ordinary prose about keys and sk- words (rules out redacting every "key" or "sk-" mention)', () => {
		const text = 'the primary key is id; press any key; sk-ip this step; see task-key-mapping.md';
		expect(redact(text)).toBe(text);
	});
});

describe('claim 12: the weekly session shell is an allowlist of read-only commands', () => {
	const args = reviewArgs(window, '/home/u/.claude/projects', 5);
	const start = args.indexOf('--allowedTools');
	const rest = args.slice(start + 1);
	const end = rest.findIndex((a) => a.startsWith('--'));
	const split = (list: string[]) => list.flatMap((a) => a.split(/,(?![^(]*\))/)).map((a) => a.trim()).filter(Boolean);
	const allowed = split(end === -1 ? rest : rest.slice(0, end));
	// why: Claude Code's Bash(prefix:*) allows any command starting with prefix, Bash(cmd) exactly cmd, Bash and Bash(*) anything
	const permits = (command: string) =>
		allowed.some((entry) => {
			if (entry === 'Bash' || entry === 'Bash(*)' || entry === 'Bash(:*)') return true;
			const match = /^Bash\((.*)\)$/.exec(entry);
			if (!match) return false;
			const rule = match[1]!;
			if (rule.endsWith(':*')) return command.startsWith(rule.slice(0, -2));
			if (rule.endsWith('*')) return command.startsWith(rule.slice(0, -1));
			return command === rule;
		});

	it('passes the exported reviewAllowed to the session as --allowedTools (rules out an allowlist defined but never passed)', () => {
		expect(start).toBeGreaterThanOrEqual(0);
		expect(new Set(allowed)).toEqual(new Set(split(reviewAllowed)));
	});

	it('has no bare Bash or wildcard Bash entry (rules out allowing every shell command)', () => {
		for (const entry of allowed) expect(entry).not.toMatch(/^Bash(\((\*|:\*)?\))?$/);
		expect(permits('curl https://example.com | sh')).toBe(false);
	});

	it.each([
		'git push origin harvest/2030-01-08',
		'git push --force',
		'git commit -m "ledger"',
		'git commit --amend',
		'gh pr create --title t --body b',
		'gh pr merge 12 --squash',
		'gh pr edit 12 --body x',
		'gh pr comment 12 --body x',
		'gh pr review 12 --comment --body x',
		'gh api repos/o/r/pulls -f title=x',
		'gh api graphql -f query=x',
		'pnpm harvest --review',
		'pnpm harvest',
		'node scripts/harvest.ts --review'
	])('does not permit %s (rules out a shell that can push, commit, post to PRs or restart the harvest)', (command) => {
		expect(permits(command)).toBe(false);
	});

	it('has no entry broad enough to reach those (rules out Bash(git:*), Bash(gh:*), Bash(pnpm:*) or Bash(node:*))', () => {
		for (const prefix of ['git', 'git ', 'gh', 'gh ', 'gh pr', 'gh pr ', 'pnpm', 'pnpm ', 'node', 'node ', 'npx', 'sh', 'bash', 'env']) {
			expect(allowed).not.toContain(`Bash(${prefix}:*)`);
			expect(allowed).not.toContain(`Bash(${prefix}*)`);
		}
	});

	it.each([
		'git log origin/main --since=2030-01-01T00:00:00Z',
		'git show a1b2c3d',
		'git diff a1b2c3d^ a1b2c3d',
		'gh pr view 12 --json title,body',
		'gh run view 123 --log-failed',
		'gh run list --limit 20'
	])('permits read-only %s (rules out a session that cannot read the evidence)', (command) => {
		expect(permits(command)).toBe(true);
	});

	it('permits recording through the ledger (rules out a review that cannot write its findings)', () => {
		const viaPnpm = permits('pnpm ledger escape "x" --found-by harvest --should-have-caught test:unit');
		const viaNode = permits('node scripts/ledger.ts escape "x" --found-by harvest --should-have-caught test:unit');
		expect(viaPnpm || viaNode).toBe(true);
	});
});

describe('claim 13: windowEvents bounds git at UTC midnight and drops gh items outside [since, until)', () => {
	const w = { since: '2030-01-01', until: '2030-01-08' };
	const flagValue = (args: string[], names: string[]) => {
		for (const [i, arg] of args.entries()) {
			for (const name of names) {
				if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
				if (arg === name) return args[i + 1];
			}
		}
		return undefined;
	};

	it('passes git a UTC-midnight timestamp for each bound, not a bare date (rules out git reading 2030-01-01 as that day at the current local time)', () => {
		const gitCalls: string[][] = [];
		windowEvents((cmd, args) => {
			if (cmd === 'git') gitCalls.push(args);
			return cmd === 'git' ? '' : null;
		}, w);
		expect(gitCalls).toHaveLength(1);
		const bounds: [string | undefined, string][] = [
			[flagValue(gitCalls[0]!, ['--since', '--after']), w.since],
			[flagValue(gitCalls[0]!, ['--until', '--before']), w.until]
		];
		for (const [value, day] of bounds) {
			expect(value).toBeDefined();
			expect(value).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(value).toMatch(/Z$|[+-]00:?00$|UTC$/);
			expect(Date.parse(value!)).toBe(Date.parse(`${day}T00:00:00Z`));
		}
	});

	const pr = (number: number, mergedAt: string) => ({ number, title: `t${number}`, mergedAt });
	const ghRun = (id: number, createdAt: string) => ({ databaseId: id, workflowName: 'CI', headBranch: 'main', event: 'push', headSha: `s${id}`, createdAt });
	const edges = (fn: (id: number, at: string) => object) => [
		fn(1, '2029-12-31T23:59:59Z'),
		fn(2, '2030-01-01T00:00:00Z'),
		fn(3, '2030-01-07T23:59:59Z'),
		fn(4, '2030-01-08T00:00:00Z'),
		fn(5, '2030-01-08T18:30:00Z')
	];
	const ghRunner: Run = (cmd, args) => {
		if (cmd === 'git') return '';
		if (args[0] === 'pr') return JSON.stringify(edges(pr));
		if (args[0] === 'run') return JSON.stringify(edges(ghRun));
		return null;
	};

	it("keeps merged PRs from since up to until, dropping the until day that gh includes (rules out trusting gh's inclusive range)", () => {
		expect(windowEvents(ghRunner, w).mergedPrs.map((p) => p.number)).toEqual([2, 3]);
	});

	it("keeps failed runs from since up to until, dropping the until day that gh includes (rules out trusting gh's inclusive range)", () => {
		expect(windowEvents(ghRunner, w).failedRuns.map((r) => r.id)).toEqual([2, 3]);
	});
});

describe('claim 14: publicBody, the fallback PR body, holds counts only', () => {
	const privateText = {
		message: 'PRIVATE-MSG my landlord Dana owes me rent',
		message2: 'PRIVATE-MSG2 call the clinic about results',
		excerpt: 'PRIVATE-EXCERPT /Users/dana/medical/notes.txt not found',
		command: 'PRIVATE-CMD cat ~/diary.md',
		transcript: 'PRIVATE-TRANSCRIPT-dana.jsonl',
		edited: '/Users/dana/PRIVATE-EDIT/plan.md',
		claim: 'PRIVATE-CLAIM git commit -m "for dana"'
	};
	const candidate = (kind: Candidate['kind'], check: string): Candidate => ({
		kind,
		check,
		transcript: privateText.transcript,
		failedAt: '2030-01-02T10:00:00Z',
		passedAt: kind === 'never-passed' ? null : '2030-01-02T10:05:00Z',
		failedCommand: privateText.command,
		passedCommand: kind === 'never-passed' ? null : privateText.command,
		failedRuns: 1,
		sharedWith: [],
		editedFiles: [privateText.edited],
		claimBefore: privateText.claim,
		excerpt: privateText.excerpt
	});
	const digest: Digest = {
		window,
		coverage: { projectsDir: '/Users/dana/.claude/projects', transcripts: 17, agentDriven: 2, maybeYou: 1, github: true },
		checks: [
			{ check: 'test:unit', runs: 9, failed: 3, minutes: 4 },
			{ check: 'lint', runs: 4, failed: 1, minutes: 1 }
		],
		candidates: [candidate('fixed-by-edit', 'test:unit'), candidate('fixed-by-edit', 'lint'), candidate('passed-on-rerun', 'test:unit'), candidate('never-passed', 'lint')],
		messages: [
			{ transcript: privateText.transcript, at: '2030-01-02T09:00:00Z', speaker: 'you', text: privateText.message },
			{ transcript: privateText.transcript, at: '2030-01-03T09:00:00Z', speaker: 'maybe-you', text: privateText.message2 }
		],
		events: { github: true, fixCommits: [], mergedPrs: [], failedRuns: [] },
		recorded: { runs: {}, escapes: [] }
	};
	const body = publicBody(window, digest, 3);

	it('contains no message text, excerpts, commands, transcript names, edited paths or claims (rules out pasting the digest or its excerpts into a public PR)', () => {
		expect(body).not.toMatch(/PRIVATE/);
		expect(body).not.toMatch(/dana/i);
		for (const word of ['landlord', 'clinic', 'diary', 'medical']) expect(body).not.toContain(word);
	});

	it('reports the counts and the window (rules out an empty or count-free body)', () => {
		expect(body).toContain(window.since);
		expect(body).toContain(window.until);
		expect(body).toMatch(/\b17\b/);
		expect(body).toMatch(/\b3\b/);
	});
});

describe('claim 15: the weekly session can write only under reports/harvest/ and verification/, and run no arbitrary code', () => {
	const args = reviewArgs(window, '/home/u/.claude/projects', 5);
	const start = args.indexOf('--allowedTools');
	const rest = args.slice(start + 1);
	const end = rest.findIndex((a) => a.startsWith('--'));
	const allowed = (end === -1 ? rest : rest.slice(0, end)).flatMap((a) => a.split(/,(?![^(]*\))/)).map((a) => a.trim()).filter(Boolean);
	// why: same reading of Claude Code's Bash(prefix:*) rules as claim 12
	const permits = (command: string) =>
		allowed.some((entry) => {
			if (entry === 'Bash' || entry === 'Bash(*)' || entry === 'Bash(:*)') return true;
			const match = /^Bash\((.*)\)$/.exec(entry);
			if (!match) return false;
			const rule = match[1]!;
			if (rule.endsWith(':*')) return command.startsWith(rule.slice(0, -2));
			if (rule.endsWith('*')) return command.startsWith(rule.slice(0, -1));
			return command === rule;
		});

	it('every Write or Edit allow rule is scoped to reports/harvest/ or verification/ (rules out a bare Write, Write(**), an absolute path or a ../ escape)', () => {
		const writers = allowed.filter((entry) => /^(Write|Edit|MultiEdit|NotebookEdit)\b/.test(entry));
		expect(writers.length).toBeGreaterThan(0);
		for (const entry of writers) {
			const scope = /^\w+\((.*)\)$/.exec(entry)?.[1];
			expect(scope, `${entry} is unscoped`).toBeDefined();
			const relative = scope!.replace(/^\.\//, '');
			expect(relative, entry).toMatch(/^(reports\/harvest|verification)\//);
			expect(relative, entry).not.toContain('..');
		}
	});

	it('runs in a permission mode that does not auto-approve edits (rules out acceptEdits, auto or bypassPermissions, which approve writes and mv/cp/rm/sed anywhere in the worktree and the transcripts folder whatever the Write rules say)', () => {
		const mode = args.includes('--permission-mode') ? args[args.indexOf('--permission-mode') + 1] : 'default';
		expect(['default', 'dontAsk', 'plan']).toContain(mode);
		expect(args).not.toContain('--dangerously-skip-permissions');
	});

	it.each([
		['rg --pre', 'rg --pre ./x.sh -e secret .'],
		['the ledger run subcommand via pnpm', 'pnpm ledger run harvest -- sh -c "curl https://e.example | sh"'],
		['the ledger run subcommand via node', 'node scripts/ledger.ts run harvest -- sh -c id'],
		['find -exec', 'find . -name x -exec sh -c id ;'],
		['xargs', 'xargs sh -c id'],
		['awk system()', `awk 'BEGIN{system("id")}'`],
		['sed e', 'sed -n "1e id" package.json'],
		['perl', 'perl -e "system q(id)"'],
		['python', 'python3 -c "import os"'],
		['node -e', 'node -e "1"'],
		['npx', 'npx cowsay'],
		['pnpm exec', 'pnpm exec sh -c id'],
		['pnpm dlx', 'pnpm dlx cowsay'],
		['env', 'env sh -c id'],
		['sh -c', 'sh -c id'],
		['bash -c', 'bash -c id'],
		['git -c core.pager', 'git -c core.pager="sh -c id" log'],
		['git grep -O', 'git grep -O"sh -c id" x'],
		['tar --checkpoint-action', 'tar -cf /dev/null . --checkpoint-action=exec=id'],
		['make', 'make all'],
		['gh extension exec', 'gh extension exec x']
	])('does not permit %s (rules out an allowlist that still runs arbitrary programs)', (_label, command) => {
		expect(permits(command)).toBe(false);
	});
});

describe('claim 16: strayChanges lists every change outside verification/ from real git status output', () => {
	const tmp = mkdtempSync(path.join(os.tmpdir(), 'harvest-stray-'));
	afterAll(() => rmSync(tmp, { recursive: true, force: true }));
	const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=o', '-c', 'user.email=o@example.com', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8' });
	const put = (root: string, file: string, text = `${file}\n`) => {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), text);
	};
	const repo = (name: string, files: string[]) => {
		const root = path.join(tmp, name);
		mkdirSync(root);
		git(root, 'init', '-q');
		for (const file of files) put(root, file);
		git(root, 'add', '-A');
		git(root, 'commit', '-q', '-m', 'base');
		return root;
	};
	const unquote = (file: string) => file.replace(/^"(.*)"$/, '$1');
	const status = (root: string) => git(root, 'status', '--porcelain', '--untracked-files=all');

	const root = repo('mixed', ['package.json', 'scripts/a.ts', 'scripts/b.ts', 'scripts/old.ts', 'scripts/into.ts', 'src/gone.ts', 'verification/runs/r1.json', 'verification/runs/moved.json']);
	writeFileSync(path.join(root, 'scripts/a.ts'), 'changed\n');
	writeFileSync(path.join(root, 'scripts/b.ts'), 'changed\n');
	git(root, 'add', 'scripts/b.ts');
	rmSync(path.join(root, 'src/gone.ts'));
	git(root, 'mv', 'scripts/old.ts', 'scripts/new.ts');
	git(root, 'mv', 'verification/runs/moved.json', 'scripts/hidden.ts');
	git(root, 'mv', 'scripts/into.ts', 'verification/into.ts');
	put(root, 'src/deep/nested/new.ts');
	put(root, '.claude/settings.json');
	put(root, 'scripts/with space.ts');
	writeFileSync(path.join(root, 'verification/runs/r1.json'), '{}\n');
	put(root, 'verification/runs/r2.json');
	const porcelain = status(root);
	const stray = strayChanges(porcelain).map(unquote);

	it('reports modified, staged, deleted, untracked-in-a-new-folder and hidden-folder files (rules out reading one status column or only top-level untracked paths)', () => {
		expect(stray).toEqual(expect.arrayContaining(['scripts/a.ts', 'scripts/b.ts', 'src/gone.ts', 'src/deep/nested/new.ts', '.claude/settings.json', 'scripts/with space.ts']));
	});

	it('reports the new side of a rename, including a file moved out of verification/ into code (rules out keeping the old side, which hides code written by renaming a ledger file)', () => {
		expect(porcelain).toMatch(/verification\/runs\/moved\.json -> scripts\/hidden\.ts/);
		expect(stray).toEqual(expect.arrayContaining(['scripts/new.ts', 'scripts/hidden.ts']));
	});

	it('reports the old side of a rename from code into verification/ (rules out keeping only the new side, which hides deleting code by moving it into the ledger)', () => {
		expect(porcelain).toMatch(/scripts\/into\.ts -> verification\/into\.ts/);
		expect(stray).toContain('scripts/into.ts');
	});

	it('never reports a path inside verification/ (rules out refusing every harvest, which always writes there)', () => {
		expect(stray.filter((file) => file.startsWith('verification/'))).toEqual([]);
		const ledger = repo('ledger-only', ['verification/runs/r1.json']);
		put(ledger, 'verification/runs/r2.json');
		put(ledger, 'verification/escapes/e1.json');
		expect(strayChanges(status(ledger))).toEqual([]);
	});

	it('returns nothing for a clean tree (rules out a refusal on empty output)', () => {
		expect(strayChanges(status(repo('clean', ['scripts/a.ts'])))).toEqual([]);
	});

	// why: the wrapper reads status through a git helper that trims its output, which strips the leading space of a first " M" line
	it('reads the output as the wrapper passes it, trimmed (rules out slicing fixed columns, which turns " M verification/x" into "erification/x" and refuses a clean harvest)', () => {
		const ledger = repo('trimmed-ledger', ['verification/runs/r1.json', 'verification/runs/r2.json']);
		writeFileSync(path.join(ledger, 'verification/runs/r1.json'), '{}\n');
		expect(status(ledger).startsWith(' M ')).toBe(true);
		expect(strayChanges(status(ledger).trim())).toEqual([]);

		const code = repo('trimmed-code', ['scripts/a.ts']);
		writeFileSync(path.join(code, 'scripts/a.ts'), 'changed\n');
		expect(strayChanges(status(code).trim())).toEqual(['scripts/a.ts']);
	});
});

// why: built at runtime so no literal secret is committed and push protection has nothing to flag
const secrets = {
	anthropic: ['sk', 'ant', 'api03', 'Q3vX9bLm2Rt8Yw4Np6Ks1Df7Gh0Jz5aBc'].join('-'),
	github: 'gh' + 'p_' + 'Q3vX9bLm2Rt8Yw4Np6Ks1Df7Gh0Jz5aBcD',
	githubPat: 'github' + '_pat_' + '11ABCDEFG0Q3vX9bLm2Rt8_Yw4Np6Ks1Df7Gh0Jz5',
	aws: 'AK' + 'IA' + 'Q3VX9BLM2RT8YW4N',
	jwt: ['ey' + 'JhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'Q3vX9bLm2Rt8Yw4Np6Ks1Df7'].join('.'),
	bearer: 'Q3vX9bLm2Rt8Yw4Np6Ks1D',
	password: 'hunter2' + 'Q3vX9b'
};

describe('claim 17: secretShaped is true for any secret redact removes, false for ordinary text', () => {
	it.each([
		['an Anthropic key', `the API said 401 for ${secrets.anthropic}`],
		['an OpenAI key', `OpenAI rejected ${openai.project}`],
		['a GitHub token', `git clone https://${secrets.github}@github.com/o/r`],
		['a fine-grained GitHub PAT', `GH=${secrets.githubPat}`],
		['an AWS access key id', `aws configure set aws_access_key_id ${secrets.aws}`],
		['a JWT', `cookie: session=${secrets.jwt}`],
		['a bearer token', `curl -H "Authorization: Bearer ${secrets.bearer}"`],
		['a password assignment', `password=${secrets.password}`],
		['a KEY-named variable', `DEPLOY_KEY=${openai.keyValue}`],
		['credentials in a URL', `postgres://admin:${secrets.password}@db.example.com/app`]
	])('is true for %s (rules out checking only some of the patterns redact knows)', (_label, text) => {
		expect(redact(text)).not.toBe(text);
		expect(secretShaped(`## Harvest\n\n${text}\n`)).toBe(true);
	});

	it('is false for every ledger record committed in verification/ (rules out a check that refuses the files it exists to publish)', () => {
		const files = globSync(path.join(import.meta.dirname, '../verification/**/*.json'));
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) expect(secretShaped(readFileSync(file, 'utf8')), file).toBe(false);
	});

	it('is false for the harvest run record of a session that spent millions of tokens (rules out reading "tokens": 2400000, as a token assignment and refusing every real harvest)', () => {
		const ledgerRoot = mkdtempSync(path.join(os.tmpdir(), 'harvest-record-'));
		try {
			const file = writeRecord(ledgerRoot, { at: '2030-01-08T09:00:00.000Z', by: 'harvest', result: 'pass', tokens: 2_400_000, usd: 8.42, minutes: 41.5, detail: '2030-01-01..2030-01-08' });
			expect(secretShaped(readFileSync(file, 'utf8'))).toBe(false);
		} finally {
			rmSync(ledgerRoot, { recursive: true, force: true });
		}
	});

	it('is false for the fallback PR body and ordinary prose about tokens, keys and passwords (rules out flagging every mention)', () => {
		const digest: Digest = {
			window,
			coverage: { projectsDir: '/home/u/.claude/projects', transcripts: 1234567, agentDriven: 0, maybeYou: 0, github: true },
			checks: [{ check: 'test:unit', runs: 12345678, failed: 0, minutes: 1 }],
			candidates: [],
			messages: [],
			events: { github: true, fixCommits: [], mergedPrs: [], failedRuns: [] },
			recorded: { runs: {}, escapes: [] }
		};
		expect(secretShaped(publicBody(window, digest, 2))).toBe(false);
		const prose = 'The oracle spent 690024 tokens. Rotate the deploy key after the password reset flow ships; see sha a1b2c3d4e5f6 and https://github.com/o/r/pull/38.';
		expect(secretShaped(prose)).toBe(false);
	});
});

describe('claim 18: checkBudget accepts a positive dollar amount and throws otherwise', () => {
	it.each([
		['10', 10],
		['0.5', 0.5],
		['7.25', 7.25]
	])('accepts %s as %d dollars (rules out integer-only parsing)', (value, usd) => {
		expect(checkBudget(value)).toBe(usd);
	});

	it.each([
		['zero', '0'],
		['negative', '-1'],
		['a negative cent', '-0.01'],
		['non-numeric', 'ten'],
		['trailing text', '10abc'],
		['empty', ''],
		['blank', '  '],
		['NaN', 'NaN'],
		['Infinity, which uncaps the session', 'Infinity']
	])('throws on %s (rules out Number() alone, which reads "" as 0 and "Infinity" as a budget, or parseFloat, which reads "10abc" as 10)', (_label, value) => {
		expect(() => checkBudget(value)).toThrow();
	});
});
