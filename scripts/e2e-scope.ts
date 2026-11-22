import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rendered = ['src/**', 'static/**', 'data/curated/**', 'data/normalized/**', 'plan/**', 'e2e/**', 'playwright.config.ts'];
const notRendered = ['**/*.spec.ts', '**/*.test.ts', 'src/routes/api/**', 'src/lib/server/**', 'src/env.ts'];
const everyPage = ['src/routes/+layout.*', 'src/app.html', 'src/lib/ui/**'];
const matches = (file: string, globs: string[]) => globs.some((glob) => path.posix.matchesGlob(file, glob));
const renderedFiles = (changed: string[]) => changed.filter((file) => matches(file, rendered) && !matches(file, notRendered));

// why: e2e takes minutes, so a PR runs it only when it changes what's rendered; main runs it after every merge.
export const changesRendering = (changed: string[]) => renderedFiles(changed).length > 0;

export interface Shot {
	name: string;
	page: string;
	spec: string;
}

const routeOf = (file: string) => '/' + path.posix.dirname(file.replace(/^src\/routes\/?/, '')).split('/').filter((s) => s !== '.' && !/^\(.*\)$/.test(s)).join('/');
const pageMatches = (page: string, route: string, prefix: boolean) =>
	new RegExp(`^${route.replace(/\/$/, '').replace(/\[[^\]]+\]/g, '[^/]+')}${prefix ? '(/.*)?' : '/?'}$`).test(page);

// why: best effort for human reviewers; a change with no page of its own (domain, data, helpers) shows no screenshot rather than all of them.
export function screenshotsFor(changed: string[], shots: Shot[], importers: (feature: string) => string[]): string[] {
	const files = renderedFiles(changed);
	if (files.some((file) => matches(file, everyPage))) return shots.map(({ name }) => name).sort();
	const picked = new Set<string>();
	const pickRoute = (routeFile: string, from = shots) => {
		const layout = path.posix.basename(routeFile).startsWith('+layout');
		for (const shot of from) if (pageMatches(shot.page, routeOf(routeFile), layout)) picked.add(shot.name);
	};
	// why: a page like / renders several features; a feature with its own spec shows only that spec's screenshots of it
	const featureShots = (feature: string) => {
		const own = shots.filter(({ spec }) => new RegExp(`^e2e/${feature}(\\.desktop)?\\.e2e\\.ts$`).test(spec));
		return own.length > 0 ? own : shots;
	};
	for (const file of files) {
		const feature = /^src\/lib\/features\/([^/]+)\//.exec(file)?.[1];
		if (file.startsWith('src/routes/')) pickRoute(file);
		else if (feature) for (const routeFile of importers(feature)) pickRoute(routeFile, featureShots(feature));
		else for (const shot of shots) if (shot.spec === file) picked.add(shot.name);
	}
	return [...picked].sort();
}

if (import.meta.main) {
	const changed = readFileSync(0, 'utf8').split('\n').filter(Boolean);
	const shotsDir = process.argv[process.argv.indexOf('--screenshots') + 1];
	if (process.argv.includes('--screenshots') && shotsDir) {
		const shots = globSync(`${shotsDir}/*.json`).map((file) => ({ name: path.basename(file, '.json'), ...(JSON.parse(readFileSync(file, 'utf8')) as Omit<Shot, 'name'>) }));
		const routeFiles = globSync('src/routes/**/*.{svelte,ts}');
		const importers = (feature: string) => routeFiles.filter((file) => readFileSync(file, 'utf8').includes(`#lib/features/${feature}/`));
		console.log(screenshotsFor(changed, shots, importers).join('\n'));
	} else {
		console.log(process.argv.includes('--all') || changesRendering(changed) ? 'run' : '');
	}
}
