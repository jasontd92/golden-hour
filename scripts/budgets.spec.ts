import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { budgets, firstLoadScripts, measureBundle, overBudget, precacheFiles, timed } from './budgets.ts';

let output: string;

function write(file: string, text: string): void {
	mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
	writeFileSync(path.join(output, file), text);
}

const entry = 'export const app = 1;'.repeat(50);
const chunk = 'export const chunk = 2;'.repeat(40);
const lazy = 'export const lazy = 3;'.repeat(30);
const page = `<link rel="modulepreload" href="./_app/immutable/entry/app.A1.js"><link href="./_app/immutable/chunks/B2.js" rel="modulepreload"><script>import("./_app/immutable/entry/app.A1.js")</script>`;

beforeEach(() => {
	output = mkdtempSync(path.join(tmpdir(), 'budgets-'));
	write('client/_app/immutable/entry/app.A1.js', entry);
	write('client/_app/immutable/chunks/B2.js', chunk);
	write('client/_app/immutable/chunks/C3.js', lazy);
	write('client/_app/version.json', '{}');
	write('client/.vite/manifest.json', '{}');
	write('client/service-worker.js', 'sw');
	write('client/icon.png', 'png');
	write('prerendered/pages/index.html', page);
	write('prerendered/pages/day/2026-12-07.html', '<p>day</p>');
	write('prerendered/dependencies/__data.json', '{"a":1}');
});

afterEach(() => rmSync(output, { recursive: true, force: true }));

const gz = (text: string) => gzipSync(text, { level: 9 }).length;

describe('bundle budgets', () => {
	it('precaches what the service worker caches: client files and prerendered output, minus the worker and build manifests', () => {
		expect(precacheFiles(output).map((file) => path.relative(output, file))).toEqual([
			'client/_app/immutable/chunks/B2.js',
			'client/_app/immutable/chunks/C3.js',
			'client/_app/immutable/entry/app.A1.js',
			'client/icon.png',
			'prerendered/dependencies/__data.json',
			'prerendered/pages/day/2026-12-07.html',
			'prerendered/pages/index.html'
		]);
	});

	it('counts only the scripts the first load of / references, once each', () => {
		expect(firstLoadScripts(output).map((file) => path.relative(output, file))).toEqual([
			'client/_app/immutable/chunks/B2.js',
			'client/_app/immutable/entry/app.A1.js'
		]);
		expect(measureBundle(output).firstLoadJsGzipBytes).toBe(gz(entry) + gz(chunk));
	});

	it('sums raw and gzip bytes over the precache', () => {
		const files = [entry, chunk, lazy, 'png', '{"a":1}', '<p>day</p>', page];
		const measured = measureBundle(output);
		expect(measured.precacheRawBytes).toBe(files.reduce((total, text) => total + Buffer.byteLength(text), 0));
		expect(measured.precacheGzipBytes).toBe(files.reduce((total, text) => total + gz(text), 0));
	});

	it('passes at the measured size and fails each budget shrunk one byte below it', () => {
		const measured = measureBundle(output);
		const exact = { ...budgets, ...measured } as typeof budgets;
		expect(overBudget(measured, exact)).toEqual([]);
		for (const name of ['firstLoadJsGzipBytes', 'precacheRawBytes', 'precacheGzipBytes'] as const) {
			const shrunk = { ...exact, [name]: measured[name]! - 1 };
			expect(overBudget(measured, shrunk)).toEqual([`${name}: ${measured[name]} is over its budget of ${measured[name]! - 1}`]);
		}
	});

	it('refuses a build whose first page references no scripts, rather than measuring zero', () => {
		write('prerendered/pages/index.html', '<p>no scripts</p>');
		expect(() => measureBundle(output)).toThrow(/no _app\/immutable scripts/);
	});
});

describe('wall-time budgets', () => {
	it('times a command and fails a budget shrunk below its wall time', () => {
		const run = timed(process.execPath, ['-e', 'setTimeout(() => {}, 200)']);
		expect(run.status).toBe(0);
		expect(run.ms).toBeGreaterThanOrEqual(200);
		expect(overBudget({ syncProofMs: run.ms }, { ...budgets, syncProofMs: 100 })).toEqual([`syncProofMs: ${run.ms} is over its budget of 100`]);
		expect(overBudget({ propertySuiteMs: run.ms }, { ...budgets, propertySuiteMs: run.ms })).toEqual([]);
	});
});
