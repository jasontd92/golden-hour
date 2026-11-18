import { expect, it } from 'vitest';
import { parseCsvRecords, parseCsvRows } from './csv.ts';

it('parses quoted fields, doubled quotes and newlines like csv.reader with universal newlines', () => {
	expect(parseCsvRows('a,b\r\n"x, ""y""","line\r\nbreak"\n\nlast,\n')).toStrictEqual([
		['a', 'b'],
		['x, "y"', 'line\nbreak'],
		['last', '']
	]);
});

it('keys records by header and rejects ragged rows', () => {
	expect(parseCsvRecords('a,b\n1,2')).toStrictEqual([{ a: '1', b: '2' }]);
	expect(() => parseCsvRecords('a,b\n1')).toThrow(/row 2/);
});
