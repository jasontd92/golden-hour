import path from 'node:path';
import { listRepoFiles, report } from './repo-files.ts';

export const markdownAllowlist = [
	'README.md',
	'AGENTS.md',
	'CLAUDE.md',
	'.claude/agents/**',
	'data/README.md',
	'data/normalized/REPORT.md',
	'team/**',
	'profiles/**',
	'prompts/**',
	'.sprint/**'
];

export function markdownProblems(files: string[]): string[] {
	const stray = files.filter(
		(file) =>
			/\.(md|markdown|mdx)$/i.test(file) &&
			!markdownAllowlist.some((glob) => path.posix.matchesGlob(file, glob))
	);
	return stray.map(
		(file) =>
			`${file}: markdown is allowed only in ${markdownAllowlist.join(', ')}. Stale prose anchors agents; express the intent as a name, type, lint rule or test instead, or delete the file.`
	);
}

if (import.meta.main) report(markdownProblems(listRepoFiles()), 'check-md: ok');
