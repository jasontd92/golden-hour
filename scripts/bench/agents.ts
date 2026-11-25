import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sh } from './clone.ts';

export type Role = 'planter' | 'verifier';

export interface AgentConfig {
	model: string;
	effort: string | null;
}

export const efforts = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export function parseAgentConfig(spec: string): AgentConfig {
	const [model, effort, ...rest] = spec.split(':');
	if (!model || rest.length > 0) throw new Error(`agent spec ${spec} is not <model>[:<effort>]`);
	if (effort !== undefined && !(efforts as readonly string[]).includes(effort)) throw new Error(`effort ${effort} is not one of ${efforts.join(', ')}`);
	return { model, effort: effort ?? null };
}

export const configLabel = (config: AgentConfig) => `${config.model}:${config.effort ?? 'auto'}`;

export interface Usage {
	role: Role;
	agent: string;
	models: string[];
	costUsd: number;
	durationMs: number;
	turns: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
}

export interface AgentResult {
	text: string;
	usage: Usage;
	error: string | null;
}

const denied = ['Bash(git push:*)', 'Bash(git remote:*)', 'Bash(git config:*)', 'Bash(gh:*)', 'WebFetch', 'WebSearch', 'Agent'];

export function claudeArgs(prompt: string, maxUsd: number, config: AgentConfig): string[] {
	return [
		'--model',
		config.model,
		...(config.effort === null ? [] : ['--effort', config.effort]),
		'-p',
		prompt,
		'--output-format',
		'json',
		'--safe-mode',
		'--no-session-persistence',
		'--permission-mode',
		'acceptEdits',
		'--permission-prompts',
		'none',
		'--tools',
		'Bash,Read,Grep,Glob,Edit,Write',
		'--allowedTools',
		'Bash,Read,Grep,Glob,Edit,Write',
		'--disallowedTools',
		...denied,
		'--max-budget-usd',
		String(maxUsd)
	];
}

export function agentEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...base, GH_CONFIG_DIR: mkdtempSync(path.join(tmpdir(), 'bench-no-gh-')), GIT_TERMINAL_PROMPT: '0' };
	for (const name of Object.keys(env)) {
		if (/^(GH_TOKEN|GITHUB_TOKEN|CLAUDECODE|CLAUDE_CODE_|CLAUDE_PID|CLAUDE_EFFORT|ANTHROPIC_MODEL|AI_AGENT)/.test(name)) delete env[name];
	}
	return env;
}

const numberAt = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function parseResult(role: Role, stdout: string, wallMs: number, agent = 'default'): AgentResult {
	const empty: Usage = { role, agent, models: [], costUsd: 0, durationMs: wallMs, turns: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Record<string, unknown>;
	} catch {
		return { text: '', usage: empty, error: `no JSON result from claude: ${stdout.slice(-500)}` };
	}
	const usage = (parsed.usage ?? {}) as Record<string, unknown>;
	return {
		text: typeof parsed.result === 'string' ? parsed.result : '',
		usage: {
			role,
			agent,
			models: Object.keys((parsed.modelUsage ?? {}) as Record<string, unknown>),
			costUsd: numberAt(parsed.total_cost_usd),
			durationMs: numberAt(parsed.duration_ms) || wallMs,
			turns: numberAt(parsed.num_turns),
			inputTokens: numberAt(usage.input_tokens),
			outputTokens: numberAt(usage.output_tokens),
			cacheReadTokens: numberAt(usage.cache_read_input_tokens),
			cacheWriteTokens: numberAt(usage.cache_creation_input_tokens)
		},
		error: parsed.is_error === true ? `claude reported an error (${String(parsed.subtype)})` : null
	};
}

export function runAgent(role: Role, cwd: string, prompt: string, maxUsd: number, config: AgentConfig): AgentResult {
	const started = Date.now();
	const result = sh(cwd, 'claude', claudeArgs(prompt, maxUsd, config), { env: agentEnv(process.env), timeoutMs: 90 * 60000 });
	return parseResult(role, result.stdout, Date.now() - started, configLabel(config));
}
