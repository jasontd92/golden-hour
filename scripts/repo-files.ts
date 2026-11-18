import { execFileSync } from 'node:child_process';

export function listRepoFiles(): string[] {
	const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
		encoding: 'utf8'
	});
	return out.split('\0').filter(Boolean);
}

export function report(problems: string[], ok: string): void {
	if (problems.length === 0) {
		console.log(ok);
		return;
	}
	for (const problem of problems) console.error(problem);
	process.exitCode = 1;
}
