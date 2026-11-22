import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { RunRecord } from './ledger.ts';
import { sessionTokens } from './oracle.ts';

describe('sessionTokens', () => {
	it('sums input, output, cache read and cache creation tokens; rules out counting only input + output, or skipping the cache', () => {
		expect(sessionTokens({ usage: { input_tokens: 41, output_tokens: 18_230, cache_read_input_tokens: 2_651_002, cache_creation_input_tokens: 37_771 } })).toBe(2_707_044);
	});

	it('treats a missing count, or missing usage, as 0, not NaN', () => {
		expect(sessionTokens({ usage: { output_tokens: 500, cache_read_input_tokens: 1000 } })).toBe(1500);
		expect(sessionTokens({})).toBe(0);
	});
});

describe('oracle CLI (stand-in claude)', () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'oracle-'));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));
	const bin = path.join(dir, 'bin');
	mkdirSync(bin);
	const seen = path.join(dir, 'claude-seen.json');
	// why: a stand-in claude that records its argv and ROLE, then prints a --output-format json result, so the CLI runs without a real session
	writeFileSync(
		path.join(bin, 'claude'),
		`#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ args: process.argv.slice(2), role: process.env.ROLE ?? null }));
process.stdout.write(JSON.stringify({ type: 'result', result: 'tests written', total_cost_usd: 1.9512, duration_ms: 551400, usage: { input_tokens: 41, output_tokens: 18230, cache_read_input_tokens: 2651002, cache_creation_input_tokens: 37771 } }));
`
	);
	chmodSync(path.join(bin, 'claude'), 0o755);
	let repos = 0;
	const oracle = (...args: string[]) => {
		const root = path.join(dir, `repo-${repos++}`);
		mkdirSync(root);
		execFileSync('git', ['init', '-q'], { cwd: root });
		const { ROLE: _role, ...env } = process.env;
		const result = spawnSync('node', [path.resolve('scripts/oracle.ts'), ...args], { cwd: root, encoding: 'utf8', env: { ...env, PATH: `${bin}:${process.env.PATH}` } });
		const records = globSync(`${root}/verification/runs/*.json`).map((file) => ({ file, data: JSON.parse(readFileSync(file, 'utf8')) as RunRecord }));
		return { result, records, claude: JSON.parse(readFileSync(seen, 'utf8')) as { args: string[]; role: string | null } };
	};

	it('runs claude with ROLE=oracle even when the caller has no ROLE, and hands it the brief; rules out inheriting the implementer environment', () => {
		const { result, claude } = oracle('prove the ledger counts escapes', '--pr', '37');
		expect(result.status, result.stderr).toBe(0);
		expect(claude.role).toBe('oracle');
		expect(claude.args).toContain('prove the ledger counts escapes');
	});

	it('records one oracle run with summed tokens, usd, minutes and the --pr number; rules out recording nothing, or tokens without the cache', () => {
		const { records } = oracle('brief', '--pr', '37');
		expect(records).toHaveLength(1);
		const [{ file, data }] = records as [(typeof records)[0]];
		expect(data).toMatchObject({ by: 'oracle', result: 'pass', tokens: 2_707_044, pr: 37 });
		expect(data.usd).toBeCloseTo(1.95, 2);
		expect(data.minutes).toBeCloseTo(9.19, 2);
		expect(path.basename(file)).toBe(`${data.at.replace(/[:.]/g, '-')}-oracle.json`);
	});

	it('omits pr when --pr is not given', () => {
		const { records } = oracle('brief');
		expect(records).toHaveLength(1);
		expect(records[0]!.data).not.toHaveProperty('pr');
	});
});
