import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { mutatedFiles } from './mutation-scope.ts';
import { listRepoFiles } from './repo-files.ts';

const root = path.resolve(import.meta.dirname, '..');
const workflow = parse(readFileSync(path.join(root, '.github/workflows/mutation.yml'), 'utf8')) as {
	on: { pull_request: { paths: string[] }; push: { paths: string[] } };
};

const matchesAny = (file: string, globs: string[]) => globs.some((glob) => path.posix.matchesGlob(file, glob));
const mutated = mutatedFiles(listRepoFiles());

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

	it('picks the mutated files out of a changed-file list', () => {
		expect(mutatedFiles(['src/lib/domain/score.ts', 'src/lib/domain/score.spec.ts', 'src/routes/+page.svelte', 'scripts/csv.ts'])).toEqual([
			'src/lib/domain/score.ts',
			'scripts/csv.ts'
		]);
	});

	it('refreshes the main-branch incremental cache on the same paths', () => {
		expect(workflow.on.push.paths).toEqual(workflow.on.pull_request.paths);
	});
});
