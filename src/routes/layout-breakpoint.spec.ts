import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deskMinWidth } from '#lib/ui/viewport.svelte.ts';

describe('desktop breakpoint', () => {
	it('is the same in the layout CSS and in the viewport query', () => {
		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		expect(layout).toContain(`@media (min-width: ${deskMinWidth}px)`);
		expect(layout).toContain(`@media (width < ${deskMinWidth}px)`);
	});
});
