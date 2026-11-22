import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const testPaths = ['**/*.spec.ts', '**/*.e2e.ts', 'verification.yaml'];
export const oracleTrailer = 'Verified-by: oracle';
export const isTestPath = (file: string) => !file.endsWith('.local.spec.ts') && testPaths.some((glob) => path.posix.matchesGlob(file, glob));

export interface Commit {
	sha: string;
	parents: number;
	message: string;
	files: string[];
}

// why: the agent that implements a change must not write or weaken the tests that judge it; merges only carry other PRs' commits.
export function provenanceProblems(commits: Commit[]): string[] {
	return commits
		.filter((commit) => commit.parents < 2 && !commit.message.split('\n').some((line) => line.trim() === oracleTrailer))
		.flatMap((commit) => commit.files.filter(isTestPath).map((file) => `${commit.sha.slice(0, 7)} changes ${file} without a "${oracleTrailer}" trailer`));
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });

export function commitsIn(range: string): Commit[] {
	return git('rev-list', '--reverse', range)
		.split('\n')
		.filter(Boolean)
		.map((sha) => ({
			sha,
			parents: git('rev-list', '--parents', '-n1', sha).trim().split(' ').length - 1,
			message: git('show', '-s', '--format=%B', sha),
			files: git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha).split('\n').filter(Boolean)
		}));
}

if (import.meta.main) {
	const range = process.argv[2];
	if (!range) throw new Error('usage: node scripts/provenance.ts <base>..<head>');
	const problems = provenanceProblems(commitsIn(range));
	for (const problem of problems) console.error(problem);
	console.log(problems.length === 0 ? `provenance: ok (${range})` : `provenance: ${problems.length} problem(s). Tests come from the oracle: pnpm oracle "<brief>"`);
	if (problems.length > 0) process.exitCode = 1;
}
