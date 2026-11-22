import { readFileSync } from 'node:fs';
import path from 'node:path';

const rendered = ['src/**', 'static/**', 'data/curated/**', 'data/normalized/**', 'plan/**', 'e2e/**', 'playwright.config.ts'];
const notRendered = ['**/*.spec.ts', '**/*.test.ts', 'src/routes/api/**', 'src/lib/server/**', 'src/env.ts'];
const matches = (file: string, globs: string[]) => globs.some((glob) => path.posix.matchesGlob(file, glob));

// why: e2e takes minutes, so a PR runs it only when it changes what's rendered; main runs it after every merge.
export const changesRendering = (changed: string[]) => changed.some((file) => matches(file, rendered) && !matches(file, notRendered));

if (import.meta.main) {
	const changed = readFileSync(0, 'utf8').split('\n').filter(Boolean);
	console.log(process.argv.includes('--all') || changesRendering(changed) ? 'run' : '');
}
