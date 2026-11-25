import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { benchDir, gateSummary, isInside, stripBenchScripts } from './clone.ts';

const root = path.resolve(import.meta.dirname, '../..');

describe('planted clones', () => {
	it('strip every script that reaches into the bench, keeping the other policy steps', () => {
		const original = readFileSync(path.join(root, 'package.json'), 'utf8');
		const stripped = stripBenchScripts(original);
		expect(stripped).not.toContain(`${benchDir}/`);
		const scripts = (JSON.parse(stripped) as { scripts: Record<string, string> }).scripts;
		const before = (JSON.parse(original) as { scripts: Record<string, string> }).scripts;
		expect(scripts.policy).toBe(before.policy!.split(' && ').filter((step) => !step.includes(benchDir)).join(' && '));
		expect(scripts.check).toBe(before.check);
		expect(scripts['bench:verifiers']).toBeUndefined();
	});

	it('summarise a red gate by the lines that say why, even far above the tail', () => {
		const output = ['positive control (unmutated): passed', 'NOT KILLED crashed: sync returns after one batch', ...Array.from({ length: 100 }, (_, i) => `KILLED ${i}`), 'exit 1'].join('\n');
		const summary = gateSummary(output);
		expect(summary).toContain('NOT KILLED crashed: sync returns after one batch');
		expect(summary).toContain('exit 1');
		expect(summary).not.toContain('KILLED 10\n');
	});

	it('live outside the repo', () => {
		expect(isInside(path.join(root, 'tmp/clone'), root)).toBe(true);
		expect(isInside(root, root)).toBe(true);
		expect(isInside(path.join(path.dirname(root), 'elsewhere'), root)).toBe(false);
	});
});

describe('the verifier benchmark costs money per run', () => {
	it('is never wired into CI or a schedule', () => {
		const workflows = path.join(root, '.github/workflows');
		for (const file of readdirSync(workflows)) {
			const text = readFileSync(path.join(workflows, file), 'utf8');
			expect(text, file).not.toMatch(/bench:verifiers|scripts\/bench\/bench\.ts/);
		}
	});
});
