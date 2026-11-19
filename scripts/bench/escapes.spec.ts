import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCommand } from '../sessions/github.ts';
import { deletedRanges, escapeReport, formatEscapes } from './escapes.ts';

let repo: string;

function commit(message: string, files: Record<string, string>): void {
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
		writeFileSync(path.join(repo, file), text);
	}
	const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
	git('add', '.');
	git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-gpg-sign', '-m', message);
}

describe('escape rate', () => {
	afterEach(() => rmSync(repo, { recursive: true, force: true }));

	it('blames the lines a later fix changes back to the PR that wrote them', () => {
		repo = mkdtempSync(path.join(tmpdir(), 'escapes-'));
		execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
		commit('feat: sync (#1)', { 'src/sync.ts': 'a\nb\nc\n' });
		commit('feat: ui (#2)', { 'src/ui.ts': 'x\ny\n' });
		commit('feat: data (#3)', { 'src/data.ts': 'd\n' });
		commit('fix(sync): handle the error (#4)', { 'src/sync.ts': 'a\nB\nc\n' });
		commit('fix(ui): close the verifier gaps (#5)', { 'src/ui.ts': 'x\nY\n' });
		commit('fix(data): tighten the test (#6)', { 'src/data.spec.ts': 'new\n' });
		const report = escapeReport(runCommand(repo), 'main', false);
		expect(report.merged).toBe(6);
		expect(report.escapes.map((escape) => [escape.pr.number, 'number' in escape.fixedBy ? escape.fixedBy.number : null, escape.foundByVerifier])).toEqual([
			[1, 4, false],
			[2, 5, true]
		]);
		expect(report.rate).toBeCloseTo(1 / 6);
		expect(formatEscapes(report)).toContain('escape rate: 1/6 (17%)');
	});

	it('reads deleted line ranges from a zero-context diff', () => {
		expect(deletedRanges('@@ -3 +3 @@\n-a\n+b\n@@ -10,2 +9,0 @@\n@@ -20,0 +21,4 @@')).toEqual([
			{ start: 3, count: 1 },
			{ start: 10, count: 2 }
		]);
	});
});
