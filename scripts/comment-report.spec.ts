import { describe, expect, it } from 'vitest';
import { addedTaggedComments, marker, renderReport } from './comment-report.ts';

const diff = [
	'diff --git a/src/lib/a.ts b/src/lib/a.ts',
	'--- a/src/lib/a.ts',
	'+++ b/src/lib/a.ts',
	'@@ -3,0 +4,3 @@ export function a() {',
	'+// why: Safari drops the first frame',
	'+const b = 1;',
	'+/* developer-directed-comment: mirrors build.py */',
	'@@ -20 +23 @@',
	'-// why: old reason',
	'+\t * why: inside a block',
	'diff --git a/src/lib/Row.svelte b/src/lib/Row.svelte',
	'--- a/src/lib/Row.svelte',
	'+++ b/src/lib/Row.svelte',
	'@@ -0,0 +1 @@',
	'+<!-- why: the header must not wrap -->',
	'diff --git a/team/notes.md b/team/notes.md',
	'--- a/team/notes.md',
	'+++ b/team/notes.md',
	'@@ -0,0 +1 @@',
	'+// why: not source',
	'diff --git a/src/lib/gone.ts b/src/lib/gone.ts',
	'--- a/src/lib/gone.ts',
	'+++ /dev/null',
	'@@ -1 +0,0 @@',
	'-// why: deleted'
].join('\n');

describe('comment-report', () => {
	it('finds added tagged comments in source files with their new line numbers', () => {
		expect(addedTaggedComments(diff)).toEqual([
			{ file: 'src/lib/a.ts', line: 4, tag: 'why', text: 'Safari drops the first frame' },
			{ file: 'src/lib/a.ts', line: 6, tag: 'developer-directed-comment', text: 'mirrors build.py' },
			{ file: 'src/lib/a.ts', line: 23, tag: 'why', text: 'inside a block' },
			{ file: 'src/lib/Row.svelte', line: 1, tag: 'why', text: 'the header must not wrap' }
		]);
	});

	it('ignores tags that are not in a comment', () => {
		const code = ['+++ b/src/a.ts', '@@ -0,0 +1 @@', "+const label = 'why: because';"].join('\n');
		expect(addedTaggedComments(code)).toEqual([]);
	});

	it('renders counts per tag and a table', () => {
		const body = renderReport(addedTaggedComments(diff), 'abcdef1234');
		expect(body.startsWith(marker)).toBe(true);
		expect(body).toContain('`abcdef1`: 3 new `why:`, 1 new `developer-directed-comment:`');
		expect(body).toContain('| `why` | `src/lib/Row.svelte:1` | the header must not wrap |');
	});

	it('renders only the summary when nothing was added', () => {
		expect(renderReport([], 'abcdef1234').split('\n')).toHaveLength(2);
	});
});
