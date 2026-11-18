import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mutants, verdict } from './sync-mutants.ts';

describe('sync mutation proof', () => {
	it('counts only tagged assertion failures as kills', () => {
		const property = 'the server ends with exactly the client\'s non-undone entries, whatever the network does';
		expect(verdict([{ test: property, message: 'Error: Property failed after 3 tests\nGot AssertionError: [server] the server holds…' }], 1)).toEqual({
			kind: 'assertion',
			tags: ['[server] in property'],
			line: 'AssertionError: [server] the server holds…'
		});
		expect(verdict([{ test: property, message: 'Error: Property failed after 1 tests\nGot TypeError: x is undefined' }], 1).kind).toBe('crashed');
		expect(verdict([{ test: 'positive control', message: 'Error: No log entry 1 to change.' }], 1).kind).toBe('crashed');
		expect(verdict([{ test: 'positive control', message: 'AssertionError: [mystery] x' }], 1).kind).toBe('crashed');
		expect(verdict([], 1).kind).toBe('crashed');
	});

	it('every mutant still applies to the code it names', () => {
		for (const mutant of mutants) expect(readFileSync(mutant.file, 'utf8'), mutant.name).toMatch(mutant.search);
	});
});
