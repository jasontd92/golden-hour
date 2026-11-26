import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, globSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { escapesDir, runsDir, writeRecord, type Escape, type RunRecord } from './ledger.ts';
import { sessionTokens } from './oracle.ts';
import { runCommand, type Run } from './sessions/github.ts';
import { encodeProjectDir } from './sessions/transcripts.ts';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

export type Speaker = 'you' | 'maybe-you';

export interface Vocabulary {
	names: string[];
	tools: Map<string, string>;
	parts: Map<string, Set<string>>;
}

export interface CheckRun {
	check: string;
	transcript: string;
	at: string;
	minutes: number;
	failed: boolean;
}

export interface Candidate {
	kind: 'fixed-by-edit' | 'passed-other-command' | 'passed-on-rerun' | 'never-passed';
	check: string;
	transcript: string;
	failedAt: string;
	passedAt: string | null;
	failedCommand: string;
	passedCommand: string | null;
	failedRuns: number;
	sharedWith: string[];
	editedFiles: string[];
	claimBefore: string | null;
	excerpt: string;
}

export interface Message {
	transcript: string;
	at: string;
	speaker: Speaker;
	text: string;
}

export interface Scan {
	checkRuns: CheckRun[];
	candidates: Candidate[];
	messages: Message[];
	agentDriven: boolean;
}

export interface Window {
	since: string;
	until: string;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// why: check names come from package.json, the repo's own vocabulary, so a new script is recognised without editing this file; a tool that two scripts share can't name either
export function checkVocabulary(scripts: Record<string, string>): Vocabulary {
	const owners = new Map<string, Set<string>>();
	const own = (tool: string, name: string) => owners.set(tool, (owners.get(tool) ?? new Set()).add(name));
	for (const [name, body] of Object.entries(scripts)) {
		for (const [, file] of body.matchAll(/\bnode\s+(\S+\.[cm]?[jt]s)\b/g)) own(`node ${file}`, name);
		for (const segment of body.split(/&&|\|\||[;|]|\s--\s/)) {
			const first = segment.trim().split(/\s+/)[0];
			if (first && !['node', 'pnpm', 'npx', 'echo'].includes(first)) own(first, name);
		}
	}
	const tools = new Map([...owners].filter(([, names]) => names.size === 1).map(([tool, names]) => [tool, [...names][0]!]));
	const direct = (name: string) => [...(scripts[name] ?? '').matchAll(/\bpnpm\s+(?:run\s+)?([\w:.-]+)/g)].map((match) => match[1]!).filter((part) => part in scripts && part !== name);
	const parts = new Map<string, Set<string>>();
	for (const name of Object.keys(scripts)) {
		const seen = new Set<string>();
		const queue = direct(name);
		while (queue.length > 0) {
			const part = queue.shift()!;
			if (seen.has(part) || part === name) continue;
			seen.add(part);
			queue.push(...direct(part));
		}
		parts.set(name, seen);
	}
	return { names: Object.keys(scripts).sort((a, b) => b.length - a.length), tools, parts };
}

export function checksIn(command: string, vocabulary: Vocabulary): string[] {
	const found = new Set<string>();
	for (const name of vocabulary.names) {
		if (new RegExp(`\\bpnpm\\s+(?:run\\s+)?${escapeRegex(name)}(?=$|[\\s;&|)])`).test(command)) found.add(name);
	}
	for (const [tool, name] of vocabulary.tools) {
		if (new RegExp(`(?:^|[\\s/;&|(])${escapeRegex(tool)}(?=$|[\\s;&|)])`).test(command)) found.add(name);
	}
	return [...found].sort();
}

// why: agents often pipe a check through tail, which hides its exit code, so the output's own failure lines count too
export const failurePattern = /Exit code [1-9]|\b[1-9]\d*\s+(?:failed|failing|errors?|problems?)\b|ELIFECYCLE|Command failed/i;

export const runFailed = (isError: boolean, text: string) => isError || failurePattern.test(text);

const secretPatterns: [RegExp, string][] = [
	[/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, '[redacted]'],
	[/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '[redacted]'],
	[/\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[redacted]'],
	[/\bAKIA[0-9A-Z]{16}\b/g, '[redacted]'],
	[/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted]'],
	[/\b(Bearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi, '$1[redacted]'],
	[/((?:token|secret|password|passwd|api[_-]?key|access[_-]?key)[\w-]*["']?\s*[:=]\s*["']?)(?=[^\s"',]*[A-Za-z])[^\s"',]{8,}/gi, '$1[redacted]'],
	[/(\b[A-Z0-9]+(?:_[A-Z0-9]+)*_KEY["']?\s*[:=]\s*["']?)(?=[^\s"',]*[A-Za-z])[^\s"',]{8,}/g, '$1[redacted]'],
	[/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi, '$1[redacted]@']
];

export const redact = (text: string) => secretPatterns.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

export function excerpt(text: string, maxChars = 1200): string {
	const lines = text.split('\n').filter((line) => line.trim());
	const failing = lines.filter((line) => /fail|error|✗|×|expected|assert/i.test(line));
	return redact((failing.length > 0 ? failing : lines).slice(-12).join('\n')).slice(-maxChars);
}

// why: transcripts mark many non-human turns as user turns, including agents that type into a terminal and so look typed
const notTyped =
	/^\s*(?:<pasted_content[^>]*>\s*)?(?:You are (?:the )?agent\b|\[from: [^\]]*->|Another Claude session sent a message|<agent-message|<task-notification|\[SYSTEM NOTIFICATION|This session is being continued|\[Request interrupted|Your claude\.ai usage limit|\[Usage limit|<local-command-|Caveat: |<system-reminder>)/i;

export const agentPersona = /\byou are (?:the )?agent\b|\[from: [^\]]*->|\bherdr agent\b|<agent-message/i;

export function messageText(content: unknown): string | null {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return null;
	if (content.some((block) => isObject(block) && block.type === 'tool_result')) return null;
	return content
		.filter(isObject)
		.map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
		.join('\n');
}

export function speakerOf(record: Json, text: string): Speaker | null {
	if (record.type !== 'user' || record.isSidechain === true || record.isMeta === true || record.isCompactSummary === true) return null;
	if (typeof record.entrypoint === 'string' && record.entrypoint.startsWith('sdk')) return null;
	if (!text.trim() || notTyped.test(text)) return null;
	if (isObject(record.origin)) return record.origin.kind === 'human' ? 'you' : null;
	return 'maybe-you';
}

// why: agents also change files through the shell, so a red run then a green run with no Edit between them is not yet a flake
export const shellWrite = /(?:^|[^<>&|0-9])>{1,2}\s*[^\s&|>]|\bsed\s+-i|\bperl\s+-[a-z]*i|\btee\b|\bgit\s+(?:apply|checkout|restore|reset|stash|rebase|merge|pull|cherry-pick)\b|\b(?:mv|cp|rm|patch)\s|\bpnpm\s+(?:install|add|remove)\b/;

export const claimPattern = /\bgit\s+(?:-C\s+\S+\s+)?(commit|push)\b|\bgh\s+pr\s+(create|ready|merge)\b/;

const editTools = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

interface Open {
	failedAt: number;
	command: string;
	failedRuns: number;
	sharedWith: string[];
	edits: Set<string>;
	claimBefore: string | null;
	excerpt: string;
}

export function scanTranscript(lines: Iterable<string>, transcript: string, vocabulary: Vocabulary, window: Window): Scan {
	const since = Date.parse(window.since);
	const until = Date.parse(window.until);
	const inWindow = (at: number) => at >= since && at < until;
	const iso = (at: number) => new Date(at).toISOString();
	const scan: Scan = { checkRuns: [], candidates: [], messages: [], agentDriven: false };
	const pending = new Map<string, { checks: string[]; at: number; command: string }>();
	const open = new Map<string, Open>();
	let lastClaim: string | null = null;
	let firstHuman = true;

	const close = (check: string, state: Open, passed: { at: number; command: string } | null) => {
		if (inWindow(state.failedAt)) {
			const kind = passed === null ? 'never-passed' : state.edits.size > 0 ? 'fixed-by-edit' : passed.command !== state.command ? 'passed-other-command' : 'passed-on-rerun';
			scan.candidates.push({ kind, check, transcript, failedAt: iso(state.failedAt), passedAt: passed === null ? null : iso(passed.at), failedCommand: state.command, passedCommand: passed?.command ?? null, failedRuns: state.failedRuns, sharedWith: state.sharedWith, editedFiles: [...state.edits].sort(), claimBefore: state.claimBefore, excerpt: state.excerpt });
		}
		open.delete(check);
	};

	for (const line of lines) {
		if (!line.trim()) continue;
		let record: unknown;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}
		if (!isObject(record) || !isObject(record.message)) continue;
		const at = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : NaN;
		if (Number.isNaN(at)) continue;
		const { content } = record.message;

		if (record.type === 'assistant' && Array.isArray(content)) {
			for (const block of content.filter(isObject)) {
				if (block.type !== 'tool_use' || typeof block.id !== 'string') continue;
				const input = isObject(block.input) ? block.input : {};
				if (block.name === 'Bash' && typeof input.command === 'string') {
					const checks = checksIn(input.command, vocabulary);
					const command = redact(input.command).slice(0, 300);
					if (checks.length > 0) pending.set(block.id, { checks, at, command });
					else if (shellWrite.test(input.command)) for (const state of open.values()) state.edits.add(`shell: ${command.slice(0, 120)}`);
					const claim = claimPattern.exec(input.command);
					if (claim) lastClaim = `${claim[1] ?? claim[2]} at ${iso(at)}`;
				} else if (block.name === 'SendMessage') {
					lastClaim = `message at ${iso(at)}`;
				} else if (typeof block.name === 'string' && editTools.has(block.name)) {
					const file = input.file_path ?? input.notebook_path;
					if (typeof file === 'string') for (const state of open.values()) state.edits.add(file);
				}
			}
			continue;
		}
		if (record.type !== 'user') continue;

		if (Array.isArray(content)) {
			for (const block of content.filter(isObject)) {
				if (block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
				const call = pending.get(block.tool_use_id);
				if (!call) continue;
				pending.delete(block.tool_use_id);
				const text = typeof block.content === 'string' ? block.content : (messageText(block.content) ?? '');
				const failed = runFailed(block.is_error === true, text);
				for (const check of call.checks) {
					if (inWindow(call.at)) scan.checkRuns.push({ check, transcript, at: iso(call.at), minutes: Math.round((at - call.at) / 600) / 100, failed });
					const state = open.get(check);
					const sharedWith = call.checks.filter((other) => other !== check);
					if (failed && state) state.failedRuns++;
					else if (failed) open.set(check, { failedAt: call.at, command: call.command, failedRuns: 1, sharedWith, edits: new Set(), claimBefore: lastClaim, excerpt: excerpt(text) });
					else if (state) close(check, state, { at: call.at, command: call.command });
					for (const part of failed ? [] : (vocabulary.parts.get(check) ?? [])) {
						const covered = open.get(part);
						if (covered) close(part, covered, { at: call.at, command: call.command });
					}
				}
			}
		}

		const text = messageText(content);
		if (text === null) continue;
		let speaker = speakerOf(record, text);
		if (firstHuman && isObject(record.origin) && record.origin.kind === 'human' && record.isSidechain !== true) {
			firstHuman = false;
			if (agentPersona.test(text)) scan.agentDriven = true;
		}
		if (speaker === 'you' && scan.agentDriven) speaker = 'maybe-you';
		if (speaker && inWindow(at)) scan.messages.push({ transcript, at: iso(at), speaker, text: redact(text).slice(0, 600) });
	}
	for (const [check, state] of [...open]) close(check, state, null);
	return scan;
}

function jsonlUnder(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((entry) => entry.endsWith('.jsonl'))
		.map((entry) => path.join(dir, entry));
}

// why: sprint sessions run from the repo's parent folder and its worktrees, so those project folders are read too, keeping only transcripts that name the repo
export function transcriptFiles(projectsDir: string, root: string, sinceMs: number): string[] {
	const base = root.replace(/\/+$/, '');
	const repoDir = encodeProjectDir(base);
	const parentDir = encodeProjectDir(path.dirname(base));
	if (!existsSync(projectsDir)) return [];
	return readdirSync(projectsDir, { encoding: 'utf8' })
		.filter((name) => name === repoDir || name.startsWith(`${repoDir}-wt-`) || name === parentDir)
		.flatMap((name) => jsonlUnder(path.join(projectsDir, name)))
		.filter((file) => statSync(file).mtimeMs >= sinceMs && readFileSync(file, 'utf8').includes(base))
		.sort();
}

export interface WindowEvents {
	github: boolean;
	fixCommits: { sha: string; at: string; subject: string }[];
	mergedPrs: { number: number; title: string; mergedAt: string }[];
	failedRuns: { id: number; workflow: string; branch: string; event: string; sha: string; at: string }[];
}

const parseJson = (text: string | null): unknown => {
	try {
		return text === null ? null : JSON.parse(text);
	} catch {
		return null;
	}
};

export function windowEvents(run: Run, window: Window): WindowEvents {
	const inside = (at: string) => Date.parse(at) >= Date.parse(window.since) && Date.parse(at) < Date.parse(window.until);
	const log = run('git', ['log', 'origin/main', '--first-parent', `--since=${window.since}T00:00:00Z`, `--until=${window.until}T00:00:00Z`, '--format=%H%x1f%cI%x1f%s']) ?? '';
	const fixCommits = log
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [sha = '', at = '', subject = ''] = line.split('\x1f');
			return { sha, at, subject };
		})
		.filter(({ subject }) => /^(fix|revert)(\([^)]*\))?!?:|^Revert "/i.test(subject));
	const range = `${window.since}..${window.until}`;
	const prs = parseJson(run('gh', ['pr', 'list', '--state', 'merged', '--search', `merged:${range}`, '--limit', '200', '--json', 'number,title,mergedAt']));
	const runs = parseJson(run('gh', ['run', 'list', '--created', range, '--status', 'failure', '--limit', '500', '--json', 'databaseId,workflowName,headBranch,event,headSha,createdAt']));
	const failedRuns = (Array.isArray(runs) ? runs.filter(isObject) : [])
		.map((r) => ({ id: Number(r.databaseId), workflow: String(r.workflowName), branch: String(r.headBranch), event: String(r.event), sha: String(r.headSha), at: String(r.createdAt) }))
		.filter(({ branch, event, at }) => (branch === 'main' || event !== 'pull_request') && inside(at));
	const mergedPrs = (Array.isArray(prs) ? prs.filter(isObject) : []).map((pr) => ({ number: Number(pr.number), title: String(pr.title), mergedAt: String(pr.mergedAt) })).filter(({ mergedAt }) => inside(mergedAt));
	return { github: Array.isArray(prs) && Array.isArray(runs), fixCommits, mergedPrs, failedRuns };
}

export interface Digest {
	window: Window;
	coverage: { projectsDir: string; transcripts: number; agentDriven: number; maybeYou: number; github: boolean };
	checks: { check: string; runs: number; failed: number; minutes: number }[];
	candidates: Candidate[];
	messages: Message[];
	events: WindowEvents;
	recorded: { runs: Record<string, number>; escapes: Escape[] };
}

const readRecords = <T extends { at: string }>(dir: string, window: Window): T[] =>
	globSync(`${dir}/*.json`)
		.map((file) => JSON.parse(readFileSync(file, 'utf8')) as T)
		.filter(({ at }) => at >= window.since && at < window.until);

export function buildDigest(checkout: string, repoRoot: string, projectsDir: string, window: Window, run: Run): Digest {
	const scripts = (JSON.parse(readFileSync(path.join(checkout, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {};
	const vocabulary = checkVocabulary(scripts);
	const scans = transcriptFiles(projectsDir, repoRoot, Date.parse(window.since)).map((file) =>
		scanTranscript(readFileSync(file, 'utf8').split('\n'), path.relative(projectsDir, file), vocabulary, window)
	);
	const used = scans.filter((scan) => scan.checkRuns.length + scan.candidates.length + scan.messages.length > 0);
	const checks = new Map<string, { check: string; runs: number; failed: number; minutes: number }>();
	for (const { check, failed, minutes } of used.flatMap((scan) => scan.checkRuns)) {
		const tally = checks.get(check) ?? { check, runs: 0, failed: 0, minutes: 0 };
		tally.runs++;
		tally.failed += failed ? 1 : 0;
		tally.minutes = Math.round((tally.minutes + minutes) * 100) / 100;
		checks.set(check, tally);
	}
	const messages = used.flatMap((scan) => scan.messages).sort((a, b) => a.at.localeCompare(b.at));
	const runs: Record<string, number> = {};
	for (const { by } of readRecords<RunRecord>(path.join(checkout, runsDir), window)) runs[by] = (runs[by] ?? 0) + 1;
	const events = windowEvents(run, window);
	return {
		window,
		coverage: { projectsDir, transcripts: used.length, agentDriven: used.filter((scan) => scan.agentDriven).length, maybeYou: messages.filter(({ speaker }) => speaker === 'maybe-you').length, github: events.github },
		checks: [...checks.values()].sort((a, b) => b.runs - a.runs),
		candidates: used.flatMap((scan) => scan.candidates).sort((a, b) => a.failedAt.localeCompare(b.failedAt)),
		messages,
		events,
		recorded: { runs, escapes: readRecords<Escape>(path.join(checkout, escapesDir), window) }
	};
}

export function formatDigest(digest: Digest): string {
	const kinds = (check: string) =>
		['fixed-by-edit', 'passed-other-command', 'passed-on-rerun', 'never-passed'].map((kind) => digest.candidates.filter((c) => c.check === check && c.kind === kind).length).join('/');
	return [
		`window ${digest.window.since}..${digest.window.until}: ${digest.coverage.transcripts} transcripts (${digest.coverage.agentDriven} agent-driven), GitHub ${digest.events.github ? 'read' : 'unavailable'}`,
		'local check | runs | failed | minutes | fixed-by-edit/passed-other-command/passed-on-rerun/never-passed',
		...digest.checks.map((c) => `${c.check} | ${c.runs} | ${c.failed} | ${Math.round(c.minutes)} | ${kinds(c.check)}`),
		`your messages: ${digest.messages.filter((m) => m.speaker === 'you').length} (plus ${digest.coverage.maybeYou} unsure)`,
		`fix or revert commits on main: ${digest.events.fixCommits.length}; failed main or scheduled runs: ${digest.events.failedRuns.length}; merged PRs: ${digest.events.mergedPrs.length}`,
		`already recorded: ${Object.entries(digest.recorded.runs).map(([by, n]) => `${by} ${n}`).join(', ') || 'no runs'}; ${digest.recorded.escapes.length} escapes`
	].join('\n');
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export function checkWindow(window: Window): Window {
	const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && day(new Date(`${value}T00:00:00Z`)) === value;
	if (!valid(window.since) || !valid(window.until)) throw new Error(`--since and --until must be YYYY-MM-DD dates, got ${window.since}..${window.until}`);
	if (window.since >= window.until) throw new Error(`--since ${window.since} must be before --until ${window.until}`);
	return window;
}

export function defaultWindow(now: Date, days = 7): Window {
	const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
	return { since: day(new Date(until.getTime() - days * 86_400_000)), until: day(until) };
}

export const reviewTools = 'Read,Grep,Glob,Write,Bash';
// why: an allowlist of read-only commands, since a deny list cannot anticipate every way to push or post; Edit(path) rules are what scope the Write tool in -p mode
export const reviewAllowed = [
	'Read',
	'Grep',
	'Glob',
	'Edit(reports/harvest/**)',
	'Edit(verification/**)',
	...['git log', 'git show', 'git diff', 'git blame', 'git status', 'git rev-parse', 'gh pr view', 'gh pr list', 'gh pr diff', 'gh pr checks', 'gh run view', 'gh run list'].map((command) => `Bash(${command}:*)`),
	...['escape', 'agent', 'report'].flatMap((mode) => [`node scripts/ledger.ts ${mode}`, `pnpm ledger ${mode}`]).map((command) => `Bash(${command}:*)`),
	...['pnpm bench:escapes', 'jq', 'grep', 'ls', 'head', 'tail', 'wc', 'cat'].map((command) => `Bash(${command}:*)`)
];
export const reviewDenied = ['Bash(git push:*)', 'Bash(git commit:*)', 'Bash(git config:*)', 'Bash(git remote:*)', 'Bash(gh pr create:*)', 'Bash(gh pr merge:*)', 'Bash(gh pr edit:*)', 'Bash(gh pr comment:*)', 'Bash(gh issue:*)', 'Bash(gh api:*)', 'Bash(pnpm harvest:*)', 'WebFetch', 'WebSearch', 'Agent'];

export const reportPath = (window: Window) => `reports/harvest/${window.since}_${window.until}`;

export function reviewArgs(window: Window, projectsDir: string, maxUsd: number): string[] {
	const report = reportPath(window);
	const prompt = `Harvest ${window.since}..${window.until}. Digest: ${report}.json. Transcripts: ${projectsDir}. Write the full report to ${report}.md and the public PR body to ${report}.pr.md.`;
	return ['-p', prompt, '--agent', 'harvester', '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'default', '--add-dir', projectsDir, '--tools', reviewTools, '--allowedTools', ...reviewAllowed, '--disallowedTools', ...reviewDenied, '--max-budget-usd', String(maxUsd)];
}

// why: the wrapper is the only thing that publishes, so it refuses anything the session changed outside the ledger, or anything shaped like a secret, whatever the session was told
export function strayChanges(porcelain: string): string[] {
	return porcelain
		.split('\n')
		.filter((line) => line.trim())
		.flatMap((line) => line.replace(/^\s*[MADRCUT?! ]{1,2}\s+/, '').split(' -> '))
		.map((file) => file.replace(/^"(.*)"$/, '$1'))
		.filter((file) => !file.startsWith('verification/'));
}

export const secretShaped = (text: string) => redact(text) !== text;

export function checkBudget(value: string): number {
	const usd = Number(value);
	if (!Number.isFinite(usd) || usd <= 0) throw new Error(`--max-usd must be a positive number of dollars, got ${JSON.stringify(value)}`);
	return usd;
}

export function publicBody(window: Window, digest: Digest, escapes: number): string {
	const catches = digest.candidates.filter(({ kind }) => kind === 'fixed-by-edit').length;
	return [
		`Ledger entries from the weekly harvest of ${window.since}..${window.until}. The session wrote no public summary, so this body has counts only.`,
		'',
		`- ${digest.coverage.transcripts} transcripts, ${digest.checks.reduce((sum, { runs }) => sum + runs, 0)} local check runs, ${catches} failures fixed by an edit`,
		`- ${escapes} escapes recorded`
	].join('\n');
}

function review(root: string, projectsDir: string, window: Window, maxUsd: number): void {
	if (process.env.CI) throw new Error('pnpm harvest --review reads local transcripts and spends money, so it does not run in CI');
	const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
	const branch = `harvest/${window.until}`;
	const dir = `${root}-wt/harvest-${window.until}`;
	if (git(root, 'branch', '--list', branch) || existsSync(dir)) throw new Error(`${branch} or ${dir} already exists: remove it, or pick another --until`);
	git(root, 'fetch', '-q', 'origin', 'main');
	git(root, 'worktree', 'add', '-q', '-b', branch, dir, 'origin/main');
	const keep = (why: string) => {
		throw new Error(`${why}. Left ${dir} on ${branch} to inspect; remove both with git worktree remove --force ${dir} && git branch -D ${branch}`);
	};
	const digest = buildDigest(dir, root, projectsDir, window, runCommand(dir));
	mkdirSync(path.join(dir, 'reports/harvest'), { recursive: true });
	writeFileSync(path.join(dir, `${reportPath(window)}.json`), JSON.stringify(digest, null, '\t') + '\n');
	console.log(formatDigest(digest));
	const escapesBefore = globSync(`${path.join(dir, escapesDir)}/*.json`).length;
	const env = { ...process.env };
	for (const name of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CLAUDE_PID)$/.test(name)) delete env[name];
	const { stdout, status, error } = spawnSync('claude', reviewArgs(window, projectsDir, maxUsd), { cwd: dir, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 2 * 60 * 60_000 });
	const session = (parseJson((stdout ?? '').trim().split('\n').at(-1) ?? '') ?? {}) as { result?: string; total_cost_usd?: number; duration_ms?: number };
	writeRecord(dir, {
		at: new Date().toISOString(),
		by: 'harvest',
		result: status === 0 ? 'pass' : 'fail',
		tokens: sessionTokens(session),
		usd: Math.round((session.total_cost_usd ?? 0) * 100) / 100,
		minutes: Math.round((session.duration_ms ?? 0) / 600) / 100,
		detail: `${window.since}..${window.until}`
	});
	if (error || status !== 0) keep(`the harvest session failed (${error?.message ?? `exit ${status}`}), so nothing was pushed`);
	const bodyFile = path.join(dir, `${reportPath(window)}.pr.md`);
	if (!existsSync(bodyFile)) writeFileSync(bodyFile, publicBody(window, digest, globSync(`${path.join(dir, escapesDir)}/*.json`).length - escapesBefore));
	const stray = strayChanges(git(dir, 'status', '--porcelain', '--untracked-files=all'));
	if (stray.length > 0) keep(`the session changed files outside verification/ (${stray.join(', ')}), so nothing was pushed`);
	const published = [bodyFile, ...git(dir, 'ls-files', '--others', '--modified', '--exclude-standard', 'verification').split('\n').filter(Boolean).map((file) => path.join(dir, file))];
	const leaking = published.filter((file) => secretShaped(readFileSync(file, 'utf8')));
	if (leaking.length > 0) keep(`${leaking.join(', ')} contain something shaped like a secret, so nothing was pushed`);
	try {
		git(dir, 'add', 'verification');
		git(dir, 'commit', '-q', '-m', `chore(verification): harvest ${window.since}..${window.until}`);
		git(dir, 'push', '-q', '-u', 'origin', branch);
		console.log(execFileSync('gh', ['pr', 'create', '--head', branch, '--title', `chore(verification): harvest ${window.since}..${window.until}`, '--body-file', bodyFile], { cwd: dir, encoding: 'utf8' }).trim());
	} catch (failure) {
		keep(`publishing failed: ${(failure as Error).message.split('\n')[0]}`);
	}
	const kept = path.join(root, 'reports/harvest');
	mkdirSync(kept, { recursive: true });
	for (const file of globSync(`${path.join(dir, reportPath(window))}*`)) cpSync(file, path.join(kept, path.basename(file)));
	git(root, 'worktree', 'remove', '--force', dir);
	git(root, 'branch', '-D', branch);
	console.log(`full report, kept local: ${path.join(kept, path.basename(reportPath(window)))}.md`);
}

if (import.meta.main) {
	const { values } = parseArgs({
		options: { since: { type: 'string' }, until: { type: 'string' }, projects: { type: 'string' }, review: { type: 'boolean', default: false }, 'max-usd': { type: 'string', default: '10' } }
	});
	const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
	const root = path.dirname(common);
	const fallback = defaultWindow(new Date());
	const window = checkWindow({ since: values.since ?? fallback.since, until: values.until ?? fallback.until });
	const projectsDir = values.projects ?? path.join(os.homedir(), '.claude/projects');
	if (values.review) review(root, projectsDir, window, checkBudget(values['max-usd']));
	else {
		const here = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
		const digest = buildDigest(here, root, projectsDir, window, runCommand(here));
		const file = path.join(here, `${reportPath(window)}.json`);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(digest, null, '\t') + '\n');
		console.log(`${formatDigest(digest)}\nwrote ${path.relative(here, file)}`);
	}
}
