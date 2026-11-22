import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isTestPath, oracleTrailer } from '../provenance.ts';

interface HookInput {
	cwd?: string;
	tool_input?: { command?: string };
}

export type Verdict = { allow: true } | { allow: false; reason: string };

// why: a Claude Code PreToolUse hook; the harness runs it, so a session can't talk its way past it. CI's provenance step is the backstop.
export function judgeCommit(command: string, staged: string[], role: string | undefined): Verdict {
	if (role === 'oracle') return { allow: true };
	if (command.includes(oracleTrailer)) return { allow: false, reason: `only the oracle session (ROLE=oracle) may write the "${oracleTrailer}" trailer` };
	const tests = staged.filter(isTestPath);
	if (tests.length === 0) return { allow: true };
	return {
		allow: false,
		reason: `${tests.join(', ')}: committed tests come from the oracle (pnpm oracle "<brief>"). Keep your own checks as *.local.spec.ts, which git ignores.`
	};
}

export function judgeMerge(checks: { name: string; bucket: string }[]): Verdict {
	const blocking = checks.filter(({ bucket }) => bucket !== 'pass' && bucket !== 'skipping');
	if (checks.length === 0) return { allow: false, reason: 'no CI checks reported for this PR yet' };
	return blocking.length === 0 ? { allow: true } : { allow: false, reason: `checks not green: ${blocking.map(({ name, bucket }) => `${name} (${bucket})`).join(', ')}` };
}

if (import.meta.main) {
	const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
	const command = input.tool_input?.command ?? '';
	const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: input.cwd, encoding: 'utf8' });
	let verdict: Verdict = { allow: true };
	if (/\bgit\b[^|;&]*\bcommit\b/.test(command)) {
		const staged = run('git', ['diff', '--cached', '--name-only']).split('\n');
		const all = /\s-[a-zA-Z]*a/.test(command) ? run('git', ['diff', '--name-only']).split('\n') : [];
		verdict = judgeCommit(command, [...staged, ...all].filter(Boolean), process.env.ROLE);
	} else if (/\bgh\s+pr\s+merge\b/.test(command)) {
		const pr = /\bgh\s+pr\s+merge\s+(\d+)/.exec(command)?.[1];
		const checks = JSON.parse(run('gh', ['pr', 'checks', ...(pr ? [pr] : []), '--json', 'name,bucket'])) as { name: string; bucket: string }[];
		verdict = judgeMerge(checks);
	}
	if (!verdict.allow) {
		console.error(verdict.reason);
		process.exitCode = 2;
	}
}
