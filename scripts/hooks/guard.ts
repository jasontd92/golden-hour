import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { writeRecord } from '../ledger.ts';
import { hasOracleTrailer, isLocalCheck, isTestPath, oracleTrailer } from '../provenance.ts';

interface HookInput {
	cwd?: string;
	tool_input?: { command?: string };
}

export type Verdict = { allow: true } | { allow: false; reason: string };

// why: a Claude Code PreToolUse hook; the harness runs it, so a session can't talk its way past it. CI's provenance step is the backstop.
// why: `files` is every change the commit could contain and `message` every message text it could carry (from -m, -F, --trailer, -C or --amend), so neither depends on how the commit is spelled.
export function judgeCommit(message: string, files: string[], role: string | undefined): Verdict {
	const local = files.filter(isLocalCheck);
	if (local.length > 0) return { allow: false, reason: `${local.join(', ')}: *.local.spec.ts checks are never committed` };
	if (role === 'oracle') return { allow: true };
	if (message.includes(oracleTrailer) || hasOracleTrailer(message)) return { allow: false, reason: `only the oracle session (ROLE=oracle) may write the "${oracleTrailer}" trailer` };
	const tests = files.filter(isTestPath);
	if (tests.length === 0) return { allow: true };
	return {
		allow: false,
		reason: `${tests.join(', ')}: committed tests, their fixtures and test config come from the oracle (pnpm oracle "<brief>"). Keep your own checks as *.local.spec.ts, which git ignores.`
	};
}

// why: the places git commit reads message text from; a trailer written as `Verified-by=oracle` becomes the real trailer
export function commitMessageSources(command: string): { files: string[]; commits: string[]; text: string } {
	const words = (command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((word) => word.replace(/^(["'])([\s\S]*)\1$/, '$2'));
	const files: string[] = [];
	const commits: string[] = [];
	const trailers: string[] = [];
	for (let index = words.indexOf('commit') + 1; index > 0 && index < words.length; index++) {
		const word = words[index]!;
		if (/^[|;&]/.test(word)) break;
		const long = /^--(file|reuse-message|reedit-message|trailer)(?:=([\s\S]*))?$/.exec(word);
		const short = /^-([FCc])([\s\S]*)$/.exec(word);
		const [kind, inline] = long ? [long[1], long[2]] : short ? [short[1], short[2] || undefined] : [];
		if (!kind) continue;
		const value = inline ?? words[++index] ?? '';
		if (kind === 'file' || kind === 'F') files.push(value);
		else if (kind === 'trailer') trailers.push(value.replace(/^([^=:]+?)\s*[=:]\s*/, '$1: '));
		else commits.push(value);
	}
	return { files: files.filter((file) => file && file !== '-'), commits: commits.filter(Boolean), text: [command, ...trailers].join('\n') };
}

// why: the PR a `gh pr merge` names, wherever its number, URL or branch sits among the flags; undefined means the current branch, as gh itself does
export function mergeTarget(command: string): { pr?: string; repo?: string } {
	const words = command.slice(command.search(/\bgh\s+pr\s+merge\b/)).split(/\s+/).slice(3);
	const takesValue = new Set(['-t', '--subject', '-b', '--body', '-F', '--body-file', '-A', '--author-email', '--match-head-commit', '-R', '--repo']);
	let pr: string | undefined;
	let repo: string | undefined;
	for (let index = 0; index < words.length; index++) {
		const word = words[index]!;
		if (/^[|;&]/.test(word)) break;
		if (word === '-R' || word === '--repo') repo = words[index + 1];
		else if (word.startsWith('--repo=')) repo = word.slice('--repo='.length);
		if (takesValue.has(word)) index++;
		else if (!word.startsWith('-') && pr === undefined) pr = word;
	}
	return { ...(pr ? { pr } : {}), ...(repo ? { repo } : {}) };
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
	const lines = (text: string) => text.split('\n').filter(Boolean);
	let verdict: Verdict = { allow: true };
	try {
		if (/\bgit\b[^|;&]*\bcommit\b/.test(command)) {
			// why: staged, unstaged and untracked changes (a chained `git add` hasn't run yet), plus HEAD's own files on --amend, so -a, paths, -i and --amend can't slip tests past the hook
			const amend = /\s--amend\b/.test(command);
			const files = [...lines(run('git', ['diff', '--cached', '--name-only'])), ...lines(run('git', ['diff', '--name-only'])), ...lines(run('git', ['ls-files', '--others', '--exclude-standard'])), ...(amend ? lines(run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', 'HEAD'])) : [])];
			const sources = commitMessageSources(command);
			const message = [
				sources.text,
				...sources.files.map((file) => readFileSync(path.resolve(input.cwd ?? '.', file), 'utf8')),
				...sources.commits.map((commit) => run('git', ['show', '-s', '--format=%B', commit])),
				...(amend ? [run('git', ['show', '-s', '--format=%B', 'HEAD'])] : [])
			].join('\n');
			verdict = judgeCommit(message, [...new Set(files)], process.env.ROLE);
		} else if (/\bgh\s+pr\s+merge\b/.test(command)) {
			const { pr, repo } = mergeTarget(command);
			const checks = JSON.parse(run('gh', ['pr', 'checks', ...(pr ? [pr] : []), ...(repo ? ['--repo', repo] : []), '--json', 'name,bucket'])) as { name: string; bucket: string }[];
			verdict = judgeMerge(checks);
		}
	} catch (error) {
		// why: Claude Code only blocks on exit 2, so a guard that crashes (gh with no checks yet, no network) must refuse, not wave the command through
		verdict = { allow: false, reason: `guard could not check this command, so it refuses it: ${(error as Error).message.split('\n')[0]}` };
	}
	if (!verdict.allow) {
		try {
			writeRecord(run('git', ['rev-parse', '--show-toplevel']).trim(), { at: new Date().toISOString(), by: 'guard', result: 'blocked', detail: verdict.reason });
		} catch {
			// why: failing to record a block must not turn it into an allow
		}
		console.error(verdict.reason);
		process.exitCode = 2;
	}
}
