import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { propertySpec } from './sync-mutants.ts';

export const budgets = {
	firstLoadJsGzipBytes: 90_000,
	precacheRawBytes: 44_000_000,
	precacheGzipBytes: 5_800_000,
	propertySuiteMs: 15_000,
	syncProofMs: 110_000
};

export type Budget = keyof typeof budgets;
export type Measured = Partial<Record<Budget, number>>;

const notPrecached = ['service-worker.js', '.vite/**', '_app/version.json'];

export function precacheFiles(output: string): string[] {
	const client = globSync('**/*', { cwd: path.join(output, 'client'), withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.relative(path.join(output, 'client'), path.join(entry.parentPath, entry.name)))
		.filter((file) => !notPrecached.some((glob) => path.posix.matchesGlob(file, glob)))
		.map((file) => path.join(output, 'client', file));
	const prerendered = ['pages', 'dependencies'].flatMap((dir) =>
		globSync('**/*', { cwd: path.join(output, 'prerendered', dir), withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => path.join(entry.parentPath, entry.name))
	);
	return [...client, ...prerendered].sort();
}

export function firstLoadScripts(output: string): string[] {
	const html = readFileSync(path.join(output, 'prerendered/pages/index.html'), 'utf8');
	const referenced = [...html.matchAll(/["'(]\.?\/?(_app\/immutable\/[^"')]+\.js)["')]/g)].map((match) => match[1]!);
	return [...new Set(referenced)].sort().map((file) => path.join(output, 'client', file));
}

const gzipBytes = (file: string) => gzipSync(readFileSync(file), { level: 9 }).length;
const rawBytes = (file: string) => readFileSync(file).length;
const sum = (files: string[], size: (file: string) => number) => files.reduce((total, file) => total + size(file), 0);

export function measureBundle(output: string): Measured {
	const precache = precacheFiles(output);
	const scripts = firstLoadScripts(output);
	if (scripts.length === 0) throw new Error(`no _app/immutable scripts referenced by ${output}/prerendered/pages/index.html`);
	return {
		firstLoadJsGzipBytes: sum(scripts, gzipBytes),
		precacheRawBytes: sum(precache, rawBytes),
		precacheGzipBytes: sum(precache, gzipBytes)
	};
}

export function overBudget(measured: Measured, limits: Record<Budget, number> = budgets): string[] {
	return (Object.entries(measured) as [Budget, number][])
		.filter(([name, value]) => value > limits[name])
		.map(([name, value]) => `${name}: ${value} is over its budget of ${limits[name]}`);
}

export function budgetLines(measured: Measured, limits: Record<Budget, number> = budgets): string[] {
	return (Object.entries(measured) as [Budget, number][]).map(
		([name, value]) => `${value > limits[name] ? 'OVER' : 'ok  '} ${name}: ${value} / ${limits[name]}`
	);
}

export function timed(command: string, args: string[]): { ms: number; status: number | null } {
	const start = performance.now();
	const { status } = spawnSync(command, args, { stdio: 'inherit' });
	return { ms: Math.round(performance.now() - start), status };
}

interface VitestReport {
	success: boolean;
	testResults: { assertionResults: { duration?: number }[] }[];
}

function measureSync(): Measured {
	const report = path.join(mkdtempSync(path.join(tmpdir(), 'budget-')), 'vitest.json');
	const property = timed('pnpm', ['-s', 'vitest', '--run', propertySpec, '--reporter=json', `--outputFile=${report}`]);
	const parsed = JSON.parse(readFileSync(report, 'utf8')) as VitestReport;
	if (property.status !== 0 || !parsed.success) throw new Error(`${propertySpec} failed`);
	const proof = timed('pnpm', ['-s', 'proof:sync']);
	if (proof.status !== 0) throw new Error('pnpm proof:sync failed');
	const durations = parsed.testResults.flatMap((file) => file.assertionResults.map((test) => test.duration ?? 0));
	const propertySuiteMs = Math.round(durations.reduce((total, ms) => total + ms, 0));
	return { propertySuiteMs, syncProofMs: proof.ms };
}

if (import.meta.main) {
	const mode = process.argv[2];
	if (mode !== 'bundle' && mode !== 'sync') throw new Error('usage: node scripts/budgets.ts bundle|sync');
	const measured = mode === 'bundle' ? measureBundle('.svelte-kit/output') : measureSync();
	for (const line of budgetLines(measured)) console.log(line);
	const problems = overBudget(measured);
	for (const problem of problems) console.error(problem);
	if (problems.length > 0) process.exitCode = 1;
}
