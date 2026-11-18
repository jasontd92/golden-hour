import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { listRepoFiles } from './repo-files.ts';

const root = path.resolve(import.meta.dirname, '..');
const { mutate } = JSON.parse(readFileSync(path.join(root, 'stryker.config.json'), 'utf8')) as { mutate: string[] };
const workflow = parse(readFileSync(path.join(root, '.github/workflows/mutation.yml'), 'utf8')) as {
	on: { pull_request: { paths: string[] }; push: { paths: string[] } };
};

const matchesAny = (file: string, globs: string[]) => globs.some((glob) => path.posix.matchesGlob(file, glob));

const mutated = listRepoFiles().filter(
	(file) =>
		matchesAny(
			file,
			mutate.filter((glob) => !glob.startsWith('!'))
		) &&
		!matchesAny(
			file,
			mutate.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1))
		)
);

describe('mutation workflow scope', () => {
	it('mutates something', () => {
		expect(mutated.length).toBeGreaterThan(0);
	});

	it('runs on pull requests that touch any mutated file or its spec', () => {
		const paths = workflow.on.pull_request.paths;
		const uncovered = mutated
			.flatMap((file) => [file, file.replace(/\.ts$/, '.spec.ts')])
			.filter((file) => !matchesAny(file, paths));
		expect(uncovered).toEqual([]);
	});

	it('refreshes the main-branch incremental cache on the same paths', () => {
		expect(workflow.on.push.paths).toEqual(workflow.on.pull_request.paths);
	});
});
