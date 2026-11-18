import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { listRepoFiles, report } from './repo-files.ts';

export interface Feature {
	name: string;
	route: string;
	e2e: string;
	flags?: Record<string, boolean>;
}

const isFlagMap = (flags: unknown) =>
	typeof flags === 'object' && flags !== null && !Array.isArray(flags) && Object.values(flags).every((v) => typeof v === 'boolean');

const pageFile = /^src\/routes\/(.*?)\/?\+page(\.server)?\.(svelte|ts|js)$/;

export function routeOf(file: string): string | undefined {
	const match = pageFile.exec(file);
	if (!match) return undefined;
	const segments = (match[1] ?? '').split('/').filter((s) => s && !/^\(.*\)$/.test(s));
	return '/' + segments.join('/');
}

export function parseFeatures(text: string): { features: Feature[]; problems: string[] } {
	const data: unknown = parse(text);
	if (!Array.isArray(data)) {
		return { features: [], problems: ['features.yaml must be a list of { name, route, e2e } entries.'] };
	}
	const features: Feature[] = [];
	const problems: string[] = [];
	data.forEach((entry: unknown, index) => {
		const { name, route, e2e, flags } = (entry ?? {}) as Record<string, unknown>;
		if (typeof name !== 'string' || typeof route !== 'string' || typeof e2e !== 'string') {
			problems.push(`features.yaml entry ${index + 1} needs string fields name, route and e2e.`);
		} else if (flags !== undefined && !isFlagMap(flags)) {
			problems.push(`features.yaml: '${name}' flags must map flag names to true or false.`);
		} else {
			features.push(flags === undefined ? { name, route, e2e } : { name, route, e2e, flags: flags as Record<string, boolean> });
		}
	});
	return { features, problems };
}

export function featureProblems(features: Feature[], files: string[]): string[] {
	const fileSet = new Set(files);
	const routes = new Map<string, string>();
	for (const file of files) {
		const route = routeOf(file);
		if (route !== undefined && !routes.has(route)) routes.set(route, file);
	}
	const problems: string[] = [];
	const claimed = new Set<string>();
	for (const feature of features) {
		if (claimed.has(feature.route)) {
			problems.push(`features.yaml: route '${feature.route}' is listed twice. Keep one entry per route.`);
		}
		claimed.add(feature.route);
		if (!routes.has(feature.route)) {
			problems.push(
				`features.yaml: '${feature.name}' points at route '${feature.route}', which has no +page under src/routes. Fix the route or remove the entry.`
			);
		}
		if (!fileSet.has(feature.e2e)) {
			problems.push(
				`features.yaml: '${feature.name}' e2e test '${feature.e2e}' does not exist. Write the Playwright test or fix the path.`
			);
		}
	}
	for (const [route, file] of routes) {
		if (!claimed.has(route)) {
			problems.push(
				`${file}: route '${route}' has no features.yaml entry. Add { name, route: '${route}', e2e: e2e/<name>.e2e.ts }.`
			);
		}
	}
	return problems;
}

if (import.meta.main) {
	const { features, problems } = parseFeatures(readFileSync('features.yaml', 'utf8'));
	report([...problems, ...featureProblems(features, listRepoFiles())], 'check-features: ok');
}
