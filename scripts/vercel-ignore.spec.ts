import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const { ignoreCommand } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../vercel.json'), 'utf8')) as {
	ignoreCommand: string;
};

let repo: string;

function commit(files: Record<string, string>): void {
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
		writeFileSync(path.join(repo, file), text);
	}
	const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
	git('add', '.');
	git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-gpg-sign', '-m', 'c');
}

// why: Vercel skips the build on exit 0 and builds on exit 1
function vercelBuilds(): boolean {
	const { status } = spawnSync('sh', ['-c', ignoreCommand], { cwd: repo });
	expect([0, 1]).toContain(status);
	return status === 1;
}

describe('vercel ignoreCommand', () => {
	afterEach(() => rmSync(repo, { recursive: true, force: true }));

	function freshRepo(): void {
		repo = mkdtempSync(path.join(tmpdir(), 'vercel-ignore-'));
		execFileSync('git', ['init', '-q'], { cwd: repo });
		commit({ 'src/app.ts': 'a', '.sprint/tracker.md': 'a' });
	}

	it('skips a commit that only touches docs paths', () => {
		freshRepo();
		commit({ '.sprint/tracker.md': 'b', 'team/x.md': 'b', 'profiles/p.md': 'b', 'prompts/q.md': 'b' });
		expect(vercelBuilds()).toBe(false);
	});

	it('builds a commit that touches code, even alongside docs', () => {
		freshRepo();
		commit({ 'src/app.ts': 'b', '.sprint/tracker.md': 'b' });
		expect(vercelBuilds()).toBe(true);
	});

	it('builds a root file change such as vercel.json itself', () => {
		freshRepo();
		commit({ 'vercel.json': '{}' });
		expect(vercelBuilds()).toBe(true);
	});
});
