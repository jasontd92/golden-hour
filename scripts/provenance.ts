import { execFileSync } from 'node:child_process';
import path from 'node:path';

// why: a test is only as honest as its data and its runner's config, so those belong to the oracle too
export const testPaths = ['**/*.spec.ts', '**/*.e2e.ts', '**/fixtures/**', 'vite.config.ts', 'playwright.config.ts', 'stryker.config.json'];
export const oracleTrailer = 'Verified-by: oracle';
export const isLocalCheck = (file: string) => file.endsWith('.local.spec.ts');
export const isTestPath = (file: string) => !isLocalCheck(file) && testPaths.some((glob) => path.posix.matchesGlob(file, glob));
export const hasOracleTrailer = (message: string) => message.split('\n').some((line) => line.trim() === oracleTrailer);

export interface Commit {
	sha: string;
	parents: number;
	message: string;
	files: string[];
}

// why: the agent that implements a change must not write or weaken the tests that judge it; a merge's files are only what its conflict resolution changed, and an implementer's own checks are never committed.
export function provenanceProblems(commits: Commit[]): string[] {
	return commits.flatMap((commit) => {
		const sha = commit.sha.slice(0, 7);
		const local = commit.files.filter(isLocalCheck).map((file) => `${sha} commits ${file}; *.local.spec.ts checks stay uncommitted`);
		const tests = hasOracleTrailer(commit.message) ? [] : commit.files.filter(isTestPath).map((file) => `${sha} changes ${file} without a "${oracleTrailer}" trailer`);
		return [...local, ...tests];
	});
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });

export function commitsIn(range: string): Commit[] {
	return git('rev-list', '--reverse', range)
		.split('\n')
		.filter(Boolean)
		.map((sha) => {
			const parents = git('rev-list', '--parents', '-n1', sha).trim().split(' ').length - 1;
			// why: --remerge-diff shows only what a merge changed beyond git's own automatic merge, which is the hand-resolved part
			const files = parents > 1 ? git('show', '--remerge-diff', '--format=', '--name-only', sha) : git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha);
			return { sha, parents, message: git('show', '-s', '--format=%B', sha), files: files.split('\n').filter(Boolean) };
		});
}

if (import.meta.main) {
	const range = process.argv[2];
	if (!range) throw new Error('usage: node scripts/provenance.ts <base>..<head>');
	const problems = provenanceProblems(commitsIn(range));
	for (const problem of problems) console.error(problem);
	console.log(problems.length === 0 ? `provenance: ok (${range})` : `provenance: ${problems.length} problem(s). Tests come from the oracle: pnpm oracle "<brief>"`);
	if (problems.length > 0) process.exitCode = 1;
}
