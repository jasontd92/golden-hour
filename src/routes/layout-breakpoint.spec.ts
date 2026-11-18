import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deskMinWidth } from '#lib/ui/viewport.svelte.ts';

const layout = 'src/routes/+layout.svelte';

const allowed = [
	`${layout}: (min-width: 768px)`,
	`${layout}: (min-width: ${deskMinWidth}px)`,
	`${layout}: (width < ${deskMinWidth}px)`
];

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(file);
		return /\.(svelte|css|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [file] : [];
	});

function widthQueries(file: string, source: string): string[] {
	const queries = [...source.matchAll(/@media\s+([^{]+)\{/g)].map((m) => (m[1] ?? '').trim());
	const scripted = [...source.matchAll(/(?:matchMedia|MediaQuery)\(\s*(['"`])(.*?)\1/g)].map((m) => `(${m[2] ?? ''})`);
	return [...queries, ...scripted].filter((q) => /width/.test(q)).map((q) => `${file}: ${q}`);
}

describe('desktop breakpoint', () => {
	it('allows only the shell and desk width queries anywhere in src', () => {
		const found = sourceFiles('src').flatMap((file) => widthQueries(file, readFileSync(file, 'utf8')));
		expect(found.toSorted()).toEqual(
			[...allowed, `src/lib/ui/viewport.svelte.ts: (min-width: \${deskMinWidth}px)`].toSorted()
		);
	});

	it('catches a width query added outside the layout', () => {
		expect(widthQueries('x.svelte', '@media (max-width: 600px) { a {} }')).toEqual(['x.svelte: (max-width: 600px)']);
		expect(widthQueries('x.ts', "new MediaQuery('min-width: 900px')")).toEqual(['x.ts: (min-width: 900px)']);
		expect(widthQueries('x.css', '@media (hover: hover) { a {} }')).toEqual([]);
	});
});
