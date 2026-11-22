import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFeatures, routeOf, type Feature } from './check-features.ts';

const rendered = ['src/**', 'static/**', 'data/curated/**', 'data/normalized/**', 'plan/**', 'e2e/**', 'playwright.config.ts'];
const notRendered = ['**/*.spec.ts', '**/*.test.ts', 'src/routes/api/**', 'src/lib/server/**', 'src/env.ts'];
const matches = (file: string, globs: string[]) => globs.some((glob) => path.posix.matchesGlob(file, glob));

// why: e2e takes minutes, so PRs run only the specs for what they render; main runs the whole suite after merge.
export function e2eScope(changed: string[], features: Feature[], specs: string[]): 'all' | string[] {
	const scoped = new Set<string>();
	for (const file of changed.filter((file) => matches(file, rendered) && !matches(file, notRendered))) {
		const feature = /^src\/lib\/features\/([^/]+)\//.exec(file)?.[1];
		const route = routeOf(file);
		const owned = specs.includes(file)
			? [file]
			: feature
				? specs.filter((spec) => new RegExp(`^e2e/${feature}(\\.desktop)?\\.e2e\\.ts$`).test(spec))
				: features.filter((entry) => route !== undefined && entry.route === route).map((entry) => entry.e2e);
		if (owned.length === 0) return 'all';
		for (const spec of owned) scoped.add(spec);
	}
	return [...scoped].sort();
}

if (import.meta.main) {
	const changed = readFileSync(0, 'utf8').split('\n').filter(Boolean);
	const { features } = parseFeatures(readFileSync('features.yaml', 'utf8'));
	const scope = process.argv.includes('--all') ? 'all' : e2eScope(changed, features, globSync('e2e/*.e2e.ts').sort());
	console.log(scope === 'all' ? 'all' : scope.join(' '));
}
