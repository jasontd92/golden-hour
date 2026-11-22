import { execFileSync } from 'node:child_process';

export type CommentTag = 'why' | 'developer-directed-comment';

export interface TaggedComment {
	file: string;
	line: number;
	tag: CommentTag;
	text: string;
}

const source = /\.(ts|js|mjs|cjs|svelte)$/;
const tagged = /(?:\/\/|\/\*+|<!--|^\s*\*)\s*(why|developer-directed-comment):\s*(.*?)\s*(?:\*\/|-->)?\s*$/;

export function addedTaggedComments(diff: string): TaggedComment[] {
	const found: TaggedComment[] = [];
	let file = '';
	let line = 0;
	for (const row of diff.split('\n')) {
		if (row.startsWith('+++ ')) {
			file = row.startsWith('+++ b/') ? row.slice(6) : '';
			continue;
		}
		const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
		if (hunk) {
			line = Number(hunk[1]);
			continue;
		}
		if (!row.startsWith('+') || row.startsWith('+++')) continue;
		const match = source.test(file) ? tagged.exec(row.slice(1)) : null;
		if (match) found.push({ file, line, tag: match[1] as CommentTag, text: match[2] ?? '' });
		line++;
	}
	return found;
}

export const marker = '<!-- comment-report -->';

export function renderReport(comments: TaggedComment[], sha: string): string {
	const count = (tag: CommentTag) => comments.filter((comment) => comment.tag === tag).length;
	const rows = comments.map(
		(comment) => `| \`${comment.tag}\` | \`${comment.file}:${comment.line}\` | ${comment.text.replaceAll('|', '\\|')} |`
	);
	return [
		marker,
		`**Comment report** for \`${sha.slice(0, 7)}\`: ${count('why')} new \`why:\`, ${count('developer-directed-comment')} new \`developer-directed-comment:\``,
		...(comments.length ? ['', '| tag | where | text |', '| --- | --- | --- |', ...rows] : [])
	].join('\n');
}

if (import.meta.main) {
	const [base = 'origin/main', sha = 'HEAD'] = process.argv.slice(2);
	const diff = execFileSync('git', ['diff', '-U0', '--no-color', `${base}...${sha}`], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});
	const comments = addedTaggedComments(diff);
	console.log(renderReport(comments, execFileSync('git', ['rev-parse', sha], { encoding: 'utf8' }).trim()));
	if (comments.length === 0) process.exitCode = 3;
}
