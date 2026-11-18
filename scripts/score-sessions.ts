import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
	commitFiles,
	ghAvailable,
	prStats,
	revertCommits,
	runCommand,
	type PrStats,
	type Run
} from './sessions/github.ts';
import { scoreTranscript, sessionCommits, sessionPrs, type SessionMetrics } from './sessions/metrics.ts';
import { candidateTranscripts, readRepoTranscript, repoCwdMatcher, type Transcript } from './sessions/transcripts.ts';

export interface ScoredSession extends SessionMetrics {
	github: PrStats[];
}

export interface Score {
	githubAvailable: boolean;
	sessions: ScoredSession[];
	totals: Omit<SessionMetrics, 'label' | 'firstRelevant' | 'prs' | 'commits'>;
}

export interface ScoreOptions {
	root: string;
	projectsDir: string;
	run: Run;
	github: boolean;
}

export async function loadTranscripts(projectsDir: string, root: string): Promise<Transcript[]> {
	const isRepoCwd = repoCwdMatcher(root);
	const transcripts: Transcript[] = [];
	for (const file of candidateTranscripts(projectsDir, root)) {
		const transcript = await readRepoTranscript(file, isRepoCwd);
		if (transcript) transcripts.push(transcript);
	}
	return transcripts.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}

export async function scoreSessions(options: ScoreOptions): Promise<Score> {
	const { root, projectsDir, run } = options;
	const githubAvailable = options.github && ghAvailable(run);
	const reverts = revertCommits(run);
	const prCache = new Map<number, PrStats | null>();
	const statsFor = (pr: number): PrStats | null => {
		if (!prCache.has(pr)) prCache.set(pr, githubAvailable ? prStats(run, pr, reverts) : null);
		return prCache.get(pr) ?? null;
	};

	const sessions = (await loadTranscripts(projectsDir, root)).map((transcript): ScoredSession => {
		const github = sessionPrs(transcript).flatMap((pr) => statsFor(pr) ?? []);
		const relevant = new Set([
			...sessionCommits(transcript).flatMap((sha) => commitFiles(run, sha)),
			...github.flatMap((pr) => pr.files)
		]);
		return { ...scoreTranscript(transcript, root, relevant), github };
	});

	const totals: Score['totals'] = {
		durationMs: 0,
		toolCalls: 0,
		byTool: {},
		tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		unusedReads: 0,
		failedCalls: 0,
		repeatedSearches: 0,
		retriedCommands: 0
	};
	for (const session of sessions) {
		totals.durationMs += session.durationMs;
		totals.toolCalls += session.toolCalls;
		for (const [tool, count] of Object.entries(session.byTool)) totals.byTool[tool] = (totals.byTool[tool] ?? 0) + count;
		totals.tokens.input += session.tokens.input;
		totals.tokens.output += session.tokens.output;
		totals.tokens.cacheRead += session.tokens.cacheRead;
		totals.tokens.cacheWrite += session.tokens.cacheWrite;
		totals.unusedReads += session.unusedReads;
		totals.failedCalls += session.failedCalls;
		totals.repeatedSearches += session.repeatedSearches;
		totals.retriedCommands += session.retriedCommands;
	}
	return { githubAvailable, sessions, totals };
}

export function duration(ms: number): string {
	const minutes = Math.round(ms / 60000);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`;
}

export function count(n: number): string {
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
	return String(n);
}

const columns = [
	'session',
	'dur',
	'calls',
	'in',
	'out',
	'cache r',
	'cache w',
	'1st rel',
	'unused reads',
	'failed',
	'repeat search',
	'retried',
	'PR',
	'CI to green',
	'threads',
	'reverts'
];

function githubCells(github: PrStats[], available: boolean): string[] {
	if (!available) return ['n/a', 'n/a', 'n/a', 'n/a'];
	if (github.length === 0) return ['-', '-', '-', '-'];
	const join = (cell: (pr: PrStats) => string): string => github.map(cell).join(',');
	return [
		join((pr) => `#${pr.number}`),
		join((pr) => (pr.ciRunsToGreen === null ? `never/${pr.ciRuns}` : String(pr.ciRunsToGreen))),
		join((pr) => String(pr.reviewThreads)),
		join((pr) => String(pr.reverts))
	];
}

export function formatTable(score: Score): string {
	const rows = score.sessions.map((session) => [
		session.label,
		duration(session.durationMs),
		String(session.toolCalls),
		count(session.tokens.input),
		count(session.tokens.output),
		count(session.tokens.cacheRead),
		count(session.tokens.cacheWrite),
		session.firstRelevant ? `${duration(session.firstRelevant.ms)}/${session.firstRelevant.calls}` : '-',
		String(session.unusedReads),
		String(session.failedCalls),
		String(session.repeatedSearches),
		String(session.retriedCommands),
		...githubCells(session.github, score.githubAvailable)
	]);
	const { totals } = score;
	rows.push([
		`total (${score.sessions.length})`,
		duration(totals.durationMs),
		String(totals.toolCalls),
		count(totals.tokens.input),
		count(totals.tokens.output),
		count(totals.tokens.cacheRead),
		count(totals.tokens.cacheWrite),
		'',
		String(totals.unusedReads),
		String(totals.failedCalls),
		String(totals.repeatedSearches),
		String(totals.retriedCommands),
		'',
		'',
		'',
		''
	]);
	const widths = columns.map((column, i) => Math.max(column.length, ...rows.map((row) => (row[i] ?? '').length)));
	const line = (cells: string[]): string =>
		cells
			.map((cell, i) => (i === 0 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0)))
			.join('  ')
			.trimEnd();
	const tools = [...score.sessions, { label: 'total', byTool: totals.byTool }].map(
		({ label, byTool }) =>
			`${label}: ${Object.entries(byTool)
				.sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
				.map(([tool, n]) => `${tool} ${n}`)
				.join(' · ')}`
	);
	return [
		line(columns),
		...rows.map(line),
		'',
		'tool calls by tool',
		...tools,
		...(score.githubAvailable ? [] : ['', 'gh unavailable: PR, CI, review and revert columns are n/a'])
	].join('\n');
}

function defaultRoot(): string {
	const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
		encoding: 'utf8'
	}).trim();
	return path.dirname(common);
}

if (import.meta.main) {
	const { values } = parseArgs({
		options: {
			json: { type: 'boolean', default: false },
			root: { type: 'string' },
			projects: { type: 'string' },
			'no-github': { type: 'boolean', default: false }
		}
	});
	const root = values.root ?? defaultRoot();
	const score = await scoreSessions({
		root,
		projectsDir: values.projects ?? path.join(os.homedir(), '.claude', 'projects'),
		run: runCommand(root),
		github: !values['no-github']
	});
	console.log(values.json ? JSON.stringify(score, null, 2) : formatTable(score));
}
