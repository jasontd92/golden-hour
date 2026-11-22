import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export const budgets = {
	firstLoadJsGzipBytes: 90_000,
	precacheRawBytes: 44_000_000,
	precacheGzipBytes: 5_800_000
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

if (import.meta.main) {
	const measured = measureBundle('.svelte-kit/output');
	for (const line of budgetLines(measured)) console.log(line);
	const problems = overBudget(measured);
	for (const problem of problems) console.error(problem);
	if (problems.length > 0) process.exitCode = 1;
}
