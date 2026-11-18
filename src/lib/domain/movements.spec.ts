import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { movementIds } from './movements.ts';

it('movementIds mirror data/curated/movements.json in order', () => {
	const curated: { movements: { id: string }[] } = JSON.parse(
		readFileSync(new URL('../../../data/curated/movements.json', import.meta.url), 'utf8')
	);
	expect([...movementIds]).toStrictEqual(curated.movements.map((m) => m.id));
});
