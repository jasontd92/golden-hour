import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runCommand, type Run } from '../sessions/github.ts';

export interface MergedPr {
	sha: string;
	number: number;
	subject: string;
}

export interface Escape {
	pr: MergedPr;
	fixedBy: MergedPr | { sha: string; subject: string };
	foundByVerifier: boolean;
}

export interface EscapeReport {
	merged: number;
	escapes: Escape[];
	rate: number;
}

const prSubject = /\(#(\d+)\)$/;
const fixSubject = /^(fix(\([^)]*\))?!?:|revert(\([^)]*\))?!?:|Revert ")/i;
const productFile = (file: string) =>
	!/(\.spec\.ts$|^e2e\/|\.md$|^\.sprint\/|^team\/|^profiles\/|^prompts\/|^data\/|^plan\/|^schemas\/|^fixtures\/)/.test(file);

export function mainline(run: Run, ref: string): { sha: string; subject: string; body: string }[] {
	const out = run('git', ['log', ref, '--first-parent', '--reverse', '--format=%H%x1f%s%x1f%b%x1e']) ?? '';
	return out
		.split('\x1e')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [sha = '', subject = '', body = ''] = entry.split('\x1f');
			return { sha, subject, body };
		});
}

export function deletedRanges(diff: string): { start: number; count: number }[] {
	return [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/gm)]
		.map((match) => ({ start: Number(match[1]), count: match[2] === undefined ? 1 : Number(match[2]) }))
		.filter((range) => range.count > 0);
}

export function blamedCommits(run: Run, parent: string, file: string, range: { start: number; count: number }): string[] {
	const out = run('git', ['blame', '--porcelain', '-L', `${range.start},+${range.count}`, parent, '--', file]) ?? '';
	return [...new Set([...out.matchAll(/^([0-9a-f]{40}) \d+ \d+/gm)].map((match) => match[1]!))];
}

export const verifierFound = /\bverifier|\bverdict/i;

export function escapeReport(run: Run, ref = 'origin/main', github = true): EscapeReport {
	const commits = mainline(run, ref);
	const merged = new Map<string, MergedPr>();
	for (const commit of commits) {
		const number = prSubject.exec(commit.subject)?.[1];
		if (number !== undefined) merged.set(commit.sha, { sha: commit.sha, number: Number(number), subject: commit.subject });
	}
	const escapes = new Map<number, Escape>();
	for (const fix of commits.filter((commit) => fixSubject.test(commit.subject))) {
		const parent = `${fix.sha}^`;
		const files = (run('git', ['diff', '--name-only', parent, fix.sha]) ?? '').split('\n').filter(Boolean).filter(productFile);
		const blamed = new Set<string>();
		for (const file of files) {
			const diff = run('git', ['diff', '-U0', parent, fix.sha, '--', file]) ?? '';
			for (const range of deletedRanges(diff)) for (const sha of blamedCommits(run, parent, file, range)) blamed.add(sha);
		}
		const fixedBy = merged.get(fix.sha) ?? { sha: fix.sha, subject: fix.subject };
		const prBody = github && 'number' in fixedBy ? (run('gh', ['pr', 'view', String(fixedBy.number), '--json', 'body', '-q', '.body']) ?? '') : '';
		const foundByVerifier = verifierFound.test(`${fix.subject}\n${fix.body}\n${prBody}`);
		for (const sha of blamed) {
			const pr = merged.get(sha);
			if (pr === undefined || pr.sha === fix.sha) continue;
			const known = escapes.get(pr.number);
			if (known === undefined || (known.foundByVerifier && !foundByVerifier)) escapes.set(pr.number, { pr, fixedBy, foundByVerifier });
		}
	}
	const all = [...escapes.values()].sort((a, b) => a.pr.number - b.pr.number);
	const unseen = all.filter((escape) => !escape.foundByVerifier).length;
	return { merged: merged.size, escapes: all, rate: merged.size === 0 ? 0 : unseen / merged.size };
}

export function formatEscapes(report: EscapeReport): string {
	const unseen = report.escapes.filter((escape) => !escape.foundByVerifier);
	const label = (fixedBy: Escape['fixedBy']) => ('number' in fixedBy ? `#${fixedBy.number}` : fixedBy.sha.slice(0, 7));
	return [
		`merged PRs: ${report.merged}`,
		`escape rate: ${unseen.length}/${report.merged} (${(100 * report.rate).toFixed(0)}%), PRs whose lines a later fix or revert changed, where neither the fix commit nor its PR cites a verifier`,
		...unseen.map((escape) => `  #${escape.pr.number} ${escape.pr.subject} → fixed by ${label(escape.fixedBy)}`),
		`fixed after a verifier finding (not escapes): ${report.escapes.length - unseen.length}`,
		...report.escapes.filter((escape) => escape.foundByVerifier).map((escape) => `  #${escape.pr.number} → ${label(escape.fixedBy)}`)
	].join('\n');
}

if (import.meta.main) {
	const { values } = parseArgs({ options: { ref: { type: 'string', default: 'origin/main' }, json: { type: 'boolean', default: false }, 'no-github': { type: 'boolean', default: false } } });
	const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
	const report = escapeReport(runCommand(path.dirname(common)), values.ref, !values['no-github']);
	console.log(values.json ? JSON.stringify(report, null, 2) : formatEscapes(report));
}
