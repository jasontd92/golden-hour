import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const benchDir = 'scripts/bench';

export interface Shell {
	ok: boolean;
	stdout: string;
	output: string;
}

export function sh(cwd: string, cmd: string, args: string[], options: { input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Shell {
	const result = spawnSync(cmd, args, {
		cwd,
		encoding: 'utf8',
		input: options.input,
		timeout: options.timeoutMs,
		env: options.env ?? process.env,
		maxBuffer: 256 * 1024 * 1024
	});
	return { ok: result.status === 0, stdout: result.stdout ?? '', output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}` };
}

function must(result: Shell, what: string): string {
	if (!result.ok) throw new Error(`${what} failed:\n${result.output.slice(-2000)}`);
	return result.output;
}

export function isInside(child: string, parent: string): boolean {
	const relative = path.relative(path.resolve(parent), path.resolve(child));
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function stripBenchScripts(packageJson: string): string {
	const pkg = JSON.parse(packageJson) as { scripts?: Record<string, string> };
	const scripts: Record<string, string> = {};
	for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
		const kept = command
			.split(' && ')
			.filter((step) => !step.includes(`${benchDir}/`))
			.join(' && ');
		if (kept !== '') scripts[name] = kept;
	}
	return `${JSON.stringify({ ...pkg, scripts }, null, '\t')}\n`;
}

const git = (dir: string, ...args: string[]) => must(sh(dir, 'git', ['-c', 'user.name=bench', '-c', 'user.email=bench@localhost', '-c', 'commit.gpgsign=false', ...args]), `git ${args[0]}`);

export function exportBase(repo: string, sha: string, dir: string): void {
	mkdirSync(dir, { recursive: true });
	const archive = path.join(path.dirname(dir), `${path.basename(dir)}.tar`);
	must(sh(repo, 'git', ['archive', '--format=tar', `--output=${archive}`, sha]), 'git archive');
	must(sh(dir, 'tar', ['-xf', archive], { env: { ...process.env, COPYFILE_DISABLE: '1' } }), 'tar');
	rmSync(archive);
	rmSync(path.join(dir, benchDir), { recursive: true, force: true });
	const packageJson = path.join(dir, 'package.json');
	writeFileSync(packageJson, stripBenchScripts(readFileSync(packageJson, 'utf8')));
	git(dir, 'init', '-q', '-b', 'main');
	git(dir, 'add', '.');
	git(dir, 'commit', '-q', '-m', `main at ${sha.slice(0, 7)}`);
}

export function install(dir: string): void {
	must(sh(dir, 'pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { timeoutMs: 15 * 60000 }), 'pnpm install');
}

export const gates = [
	['pnpm', 'check'],
	['pnpm', 'proof:sync']
] as const;

export function runGates(dir: string): { ok: true } | { ok: false; gate: string; tail: string } {
	for (const [cmd, ...args] of gates) {
		const result = sh(dir, cmd, args, { timeoutMs: 30 * 60000 });
		if (!result.ok) return { ok: false, gate: `${cmd} ${args.join(' ')}`, tail: result.output.split('\n').slice(-40).join('\n') };
	}
	return { ok: true };
}

export function workingDiff(dir: string): string {
	git(dir, 'add', '--intent-to-add', '.');
	return sh(dir, 'git', ['diff', '--no-color', '--no-ext-diff']).stdout;
}

export function resetWorkingTree(dir: string): void {
	git(dir, 'reset', '-q');
	git(dir, 'checkout', '-q', '--', '.');
	git(dir, 'clean', '-fdq');
}

export function commitPatch(dir: string, diff: string, message: string): boolean {
	if (!sh(dir, 'git', ['apply', '--whitespace=nowarn', '-'], { input: diff }).ok) return false;
	git(dir, 'add', '.');
	git(dir, 'commit', '-q', '-m', message);
	return true;
}

export function headSha(dir: string): string {
	return sh(dir, 'git', ['rev-parse', 'HEAD']).stdout.trim();
}

export function cloneWithoutHistoryLeftovers(from: string, to: string): void {
	must(sh(path.dirname(to), 'git', ['clone', '-q', '--no-local', from, to]), 'git clone');
	git(to, 'remote', 'remove', 'origin');
}
