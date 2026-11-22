import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { writeRecord } from './ledger.ts';

interface SessionResult {
	result?: string;
	total_cost_usd?: number;
	duration_ms?: number;
	usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

export const sessionTokens = ({ usage = {} }: SessionResult) =>
	(usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);

// why: the oracle runs as its own session with ROLE=oracle, and records its own cost so the ledger can weigh it against what it catches
if (import.meta.main) {
	const [brief, ...rest] = process.argv.slice(2);
	if (!brief) throw new Error('usage: pnpm oracle "<brief>" [--pr N]');
	const prIndex = rest.indexOf('--pr');
	const pr = prIndex >= 0 ? Number(rest[prIndex + 1]) : undefined;
	const args = ['-p', '--agent', 'oracle', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(git *) Bash(pnpm *) Bash(node *) Bash(gh *)', '--output-format', 'json', brief];
	const { stdout, status } = spawnSync('claude', args, { env: { ...process.env, ROLE: 'oracle' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
	const session = JSON.parse(stdout) as SessionResult;
	console.log(session.result ?? stdout);
	const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
	const file = writeRecord(root, {
		at: new Date().toISOString(),
		by: 'oracle',
		result: status === 0 ? 'pass' : 'fail',
		tokens: sessionTokens(session),
		usd: Math.round((session.total_cost_usd ?? 0) * 100) / 100,
		minutes: Math.round((session.duration_ms ?? 0) / 600) / 100,
		...(pr ? { pr } : {})
	});
	console.log(`recorded ${path.relative(root, file)}`);
	process.exitCode = status ?? 1;
}
