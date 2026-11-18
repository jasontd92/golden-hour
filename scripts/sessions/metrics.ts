import type { ToolCall, Transcript, Usage } from './transcripts.ts';

export interface FirstRelevant {
	path: string;
	ms: number;
	calls: number;
}

export interface SessionMetrics {
	label: string;
	durationMs: number;
	toolCalls: number;
	byTool: Record<string, number>;
	tokens: Usage;
	firstRelevant: FirstRelevant | null;
	unusedReads: number;
	failedCalls: number;
	repeatedSearches: number;
	retriedCommands: number;
	prs: number[];
	commits: string[];
}

const readTools = new Set(['Read']);
const editTools = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const searchTools = new Set(['Grep', 'Glob', 'WebSearch']);
const searchCommand = /^(grep|rg|find|fd|ag|git grep)\b/;
const commitLine = /^\[[^\]\s]+(?: \([^)]*\))? ([0-9a-f]{7,40})\]/m;
const prUrl = /github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/;

const command = (call: ToolCall): string => (typeof call.input.command === 'string' ? call.input.command : '');

export function stripCd(cmd: string): string {
	return cmd.trim().replace(/^(cd\s+\S+\s*&&\s*)+/, '');
}

export function commandKey(cmd: string): string {
	return stripCd(cmd).split(/\s+/).slice(0, 2).join(' ');
}

export function repoPath(file: string, root: string): string | null {
	const base = root.replace(/\/+$/, '');
	if (!file.startsWith('/')) return file.replace(/^\.\//, '');
	if (file.startsWith(`${base}/`)) return file.slice(base.length + 1);
	const worktree = file.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-wt/[^/]+/(.+)$`));
	return worktree?.[1] ?? null;
}

function filePath(call: ToolCall): string | null {
	const value = call.input.file_path ?? call.input.notebook_path;
	return typeof value === 'string' ? value : null;
}

export function sessionPrs(transcript: Transcript): number[] {
	const prs = new Set<number>();
	for (const call of transcript.calls) {
		const result = transcript.results.get(call.id);
		if (!result) continue;
		for (const pr of result.prNumbers) prs.add(pr);
		if (call.name === 'Bash' && /\bgh pr create\b/.test(command(call))) {
			const match = result.text.match(prUrl);
			if (match?.[1]) prs.add(Number(match[1]));
		}
	}
	return [...prs].sort((a, b) => a - b);
}

export function sessionCommits(transcript: Transcript): string[] {
	const commits: string[] = [];
	for (const call of transcript.calls) {
		if (call.name !== 'Bash' || !/\bgit commit\b/.test(command(call))) continue;
		const sha = transcript.results.get(call.id)?.text.match(commitLine)?.[1];
		if (sha && !commits.includes(sha)) commits.push(sha);
	}
	return commits;
}

export function mentionsPath(cmd: string, file: string): boolean {
	const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(^|[\\s'"=/])${escaped}($|[\\s'";|&)])`).test(cmd);
}

function relevantTouch(call: ToolCall, root: string, relevant: ReadonlySet<string>): string | undefined {
	if (readTools.has(call.name) || editTools.has(call.name)) {
		const raw = filePath(call);
		const file = raw === null ? null : repoPath(raw, root);
		return file !== null && relevant.has(file) ? file : undefined;
	}
	if (call.name !== 'Bash') return undefined;
	const cmd = command(call);
	return [...relevant].find((file) => mentionsPath(cmd, file));
}

function searchKey(call: ToolCall): string | null {
	if (searchTools.has(call.name)) return `${call.name} ${JSON.stringify(call.input)}`;
	if (call.name !== 'Bash') return null;
	const cmd = stripCd(command(call));
	return searchCommand.test(cmd) ? `Bash ${cmd}` : null;
}

export function scoreTranscript(transcript: Transcript, root: string, relevant: ReadonlySet<string>): SessionMetrics {
	const { calls, results } = transcript;
	const start = transcript.start ?? 0;

	const byTool: Record<string, number> = {};
	for (const call of calls) byTool[call.name] = (byTool[call.name] ?? 0) + 1;

	const tokens: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
	for (const usage of transcript.usage.values()) {
		tokens.input += usage.input;
		tokens.output += usage.output;
		tokens.cacheRead += usage.cacheRead;
		tokens.cacheWrite += usage.cacheWrite;
	}

	let firstRelevant: FirstRelevant | null = null;
	const edited = new Set<string>();
	const read = new Set<string>();
	calls.forEach((call, index) => {
		const touched = firstRelevant ? undefined : relevantTouch(call, root, relevant);
		if (touched) firstRelevant = { path: touched, ms: call.at - start, calls: index + 1 };
		const raw = filePath(call);
		const file = raw === null ? null : repoPath(raw, root);
		if (file === null) return;
		if (readTools.has(call.name)) read.add(file);
		if (editTools.has(call.name)) edited.add(file);
	});
	const unusedReads = [...read].filter((file) => !edited.has(file) && !relevant.has(file)).length;

	const failedCalls = calls.filter((call) => results.get(call.id)?.isError).length;

	const searches = new Set<string>();
	let repeatedSearches = 0;
	for (const call of calls) {
		const key = searchKey(call);
		if (key === null) continue;
		if (searches.has(key)) repeatedSearches += 1;
		searches.add(key);
	}

	const bash = calls.filter((call) => call.name === 'Bash');
	const retriedCommands = bash.filter(
		(call, index) =>
			results.get(call.id)?.isError &&
			bash.slice(index + 1).some((later) => commandKey(command(later)) === commandKey(command(call)))
	).length;

	return {
		label: transcript.label,
		durationMs: transcript.start !== null && transcript.end !== null ? transcript.end - transcript.start : 0,
		toolCalls: calls.length,
		byTool,
		tokens,
		firstRelevant,
		unusedReads,
		failedCalls,
		repeatedSearches,
		retriedCommands,
		prs: sessionPrs(transcript),
		commits: sessionCommits(transcript)
	};
}
