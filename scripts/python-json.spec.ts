import { describe, expect, it } from 'vitest';
import { floatRepr, parsePythonJson, PyFloat, pythonJsonDumps, pythonRepr } from './python-json.ts';

describe('floatRepr matches Python repr(float)', () => {
	it.each([
		[235, '235.0'],
		[64.95, '64.95'],
		[1e16, '1e+16'],
		[1.5e-5, '1.5e-05'],
		[0.0001, '0.0001'],
		[150.3000030517578, '150.3000030517578'],
		[-0.5, '-0.5'],
		[123456789012345.6, '123456789012345.6'],
		[1e22, '1e+22'],
		[5e-324, '5e-324']
	])('%d → %s', (value, repr) => {
		expect(floatRepr(value)).toBe(repr);
	});
});

describe('pythonJsonDumps matches json.dumps', () => {
	it('uses Python separators and ensure_ascii escapes', () => {
		const value = { a: [1, new PyFloat(2), {}], b: {}, c: '🍫ä\n"\u007f' };
		expect(pythonJsonDumps(value)).toBe('{"a": [1, 2.0, {}], "b": {}, "c": "\\ud83c\\udf6b\\u00e4\\n\\"\\u007f"}');
	});

	it('indents like indent=1, keeping empty containers inline', () => {
		expect(pythonJsonDumps([{ a: [1, []] }, []], 1)).toBe('[\n {\n  "a": [\n   1,\n   []\n  ]\n },\n []\n]');
	});

	it('keeps Map insertion order for integer-like keys', () => {
		expect(pythonJsonDumps(new Map([['2', 1], ['1', 2]]))).toBe('{"2": 1, "1": 2}');
	});

	it('round-trips float literals from parsed JSON', () => {
		expect(pythonJsonDumps(parsePythonJson('[1, 1.0, 1e2, 2.5]'))).toBe('[1, 1.0, 100.0, 2.5]');
	});
});

describe('pythonRepr matches repr()', () => {
	it.each([
		["it's", `"it's"`],
		['say "hi"', `'say "hi"'`],
		[`both ' "`, `'both \\' "'`],
		['nbsp\u00a0zwj\u200d', `'nbsp\\xa0zwj\\u200d'`],
		['tab\tback\\', `'tab\\tback\\\\'`],
		['🍫', `'🍫'`]
	])('%s', (text, repr) => {
		expect(pythonRepr(text)).toBe(repr);
	});

	it('renders a dict', () => {
		expect(pythonRepr(new Map([['a', 5], ['b', 1]]))).toBe("{'a': 5, 'b': 1}");
	});
});
