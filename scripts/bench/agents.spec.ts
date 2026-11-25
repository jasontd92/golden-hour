import { describe, expect, it } from 'vitest';
import { agentEnv, claudeArgs, parseResult } from './agents.ts';
import { catalog } from './catalog.ts';
import { parsePlanterReport, planterPrompt } from './planter-prompt.ts';

describe('headless agents', () => {
	it('run with no push, no gh, no web and a spend cap', () => {
		const args = claudeArgs('prompt', 4, { model: 'opus', effort: null });
		const denied = args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--max-budget-usd'));
		expect(denied).toEqual(expect.arrayContaining(['Bash(git push:*)', 'Bash(gh:*)', 'WebFetch', 'WebSearch']));
		expect(args).toEqual(expect.arrayContaining(['--safe-mode', '--no-session-persistence', '--max-budget-usd', '4']));
		expect(args).not.toContain('--dangerously-skip-permissions');
	});

	it('get no GitHub token and no parent Claude session', () => {
		const env = agentEnv({ GH_TOKEN: 't', GITHUB_TOKEN: 't', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', PATH: '/bin' });
		expect(env.GH_TOKEN).toBeUndefined();
		expect(env.GITHUB_TOKEN).toBeUndefined();
		expect(env.CLAUDECODE).toBeUndefined();
		expect(env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
		expect(env.PATH).toBe('/bin');
		expect(env.GH_CONFIG_DIR).toBeTruthy();
	});

	it('report cost, turns and tokens from the json result', () => {
		const stdout = JSON.stringify({
			type: 'result',
			is_error: false,
			result: 'done',
			duration_ms: 120000,
			num_turns: 7,
			total_cost_usd: 1.25,
			usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 }
		});
		expect(parseResult('verifier', stdout, 1)).toEqual({
			text: 'done',
			error: null,
			usage: { role: 'verifier', agent: 'default', models: [], costUsd: 1.25, durationMs: 120000, turns: 7, inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 }
		});
		expect(parseResult('planter', 'not json', 5).error).toContain('no JSON result');
	});
});

describe('planter', () => {
	it('is told the class, its instruction and which files to leave alone', () => {
		const bugClass = catalog[0]!;
		const prompt = planterPrompt(bugClass, ['src/a.ts']);
		expect(prompt).toContain(bugClass.description);
		expect(prompt).toContain(bugClass.plant);
		expect(prompt).toContain('src/a.ts');
	});

	it('reports behaviour, markers and a cover story', () => {
		const report = { behavior: 'sync.ts drops the error', markers: ['syncOutbox'], cover: { title: 'refactor: tidy', claims: ['same behaviour'] } };
		expect(parsePlanterReport(`done\n\`\`\`json\n${JSON.stringify(report)}\n\`\`\``)).toEqual(report);
		expect(parsePlanterReport('```json\n{"behavior": "x"}\n```')).toBeNull();
	});
});
