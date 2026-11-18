import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { buildNormalized, normalizedDir, slug, validateNormalized } from './data-build.ts';

const built = buildNormalized();

it('rebuilds the committed data/normalized byte for byte', () => {
	for (const [name, content] of Object.entries(built)) {
		expect(content, name).toBe(readFileSync(path.join(normalizedDir, name), 'utf8'));
	}
});

it('produces output that validates against the domain schemas', () => {
	expect(validateNormalized(built)).toStrictEqual([]);
});

it('slugs titles to hyphen ids', () => {
	expect(slug('  The Chief!! (Hero) ')).toBe('the-chief-hero');
});
