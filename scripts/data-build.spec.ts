import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNormalized, dataDir, normalizedDir, slug, validateNormalized } from './data-build.ts';

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

function dataCopy(edit: (file: string, text: string) => string): string {
	const root = mkdtempSync(path.join(tmpdir(), 'data-build-'));
	for (const dir of ['curated', 'raw/sugarwod']) cpSync(path.join(dataDir, dir), path.join(root, dir), { recursive: true });
	for (const file of [
		'curated/results.json',
		'curated/sugarwod_snapshot_2026-11-17.json',
		'raw/sugarwod/workouts_export_2026-11-17.csv'
	]) {
		writeFileSync(path.join(root, file), edit(file, readFileSync(path.join(root, file), 'utf8')));
	}
	return root;
}

const editCuratedResult = (change: (first: Record<string, unknown>) => void) =>
	dataCopy((file, text) => {
		if (file !== 'curated/results.json') return text;
		const results = JSON.parse(text) as Record<string, unknown>[];
		change(results[0] ?? {});
		return JSON.stringify(results);
	});

describe('the build fails loudly on input JS would read differently', () => {
	it('rejects integer-like object keys, naming the file and key', () => {
		const root = dataCopy((file, text) =>
			text.replace('"splits":{"run_5k":"18:56",', '"splits":{"run_5k":"18:56","10":"1:00","2":"2:00","1":"3:00",')
		);
		expect(() => buildNormalized(root)).toThrow(/^curated\/results\.json: object key "(10|2|1)" is integer-like/);
	});

	it('rejects integer-like keys inside SugarWOD set_details, naming the row', () => {
		const root = dataCopy((file, text) => text.replace('""rnds"":8', '""7"":8'));
		expect(() => buildNormalized(root)).toThrow('sugarwod#row2 set_details: object key "7" is integer-like');
	});

	it.each([
		['Arabic-Indic digits', '٤٦:١٨', 'U+0664'],
		['full-width digits', '４６:１８', 'U+FF14'],
		['a BOM prefix', '﻿46:18', 'U+FEFF'],
		['a C0 separator', '46:18\x1c', 'U+001C'],
		['a C1 next-line', '46:18\x85', 'U+0085'],
		['a no-break space', '46:18 ', 'U+00A0']
	])('rejects a curated score with %s, naming the record', (_label, score, codePoint) => {
		const root = editCuratedResult((first) => {
			first.score = score;
		});
		expect(() => buildNormalized(root)).toThrow(
			`curated/results.json[0] (turkey-trot-triple 2019-11): score ${JSON.stringify(score)} has ${codePoint}`
		);
	});

	it.each([
		['best_result_display', ',"8","Rounds', ',"﻿8","Rounds'],
		['best_result_raw', ',8,"8","Rounds', ',٨,"8","Rounds']
	])('rejects a SugarWOD %s outside printable ASCII, naming the row', (column, before, after) => {
		const root = dataCopy((file, text) => text.replace(before, after));
		expect(() => buildNormalized(root)).toThrow(`sugarwod#row2 ${column}: score`);
	});
});

const gummyWormSets = '"[{""rnds"":8,""reps"":0}]"';
const editSugarwod = (before: string, after: string) =>
	dataCopy((file, text) => (file.startsWith('raw/sugarwod/') ? text.replace(before, after) : text));

describe('the build names the source record when it fails', () => {
	it.each([
		['an object', '"{""rnds"":8}"', 'expected a JSON array of sets, got {"rnds":8}'],
		['a number', '"5"', 'expected a JSON array of sets, got 5'],
		['an array of numbers', '"[5]"', 'set 0 is not an object'],
		['an array of floats', '"[1.5]"', 'set 0 is not an object'],
		['an array of arrays', '"[[]]"', 'set 0 is not an object']
	])('rejects SugarWOD set_details that is %s', (_label, setDetails, message) => {
		expect(() => buildNormalized(editSugarwod(gummyWormSets, setDetails))).toThrow(
			`sugarwod#row2 set_details: ${message}`
		);
	});

	it('names the row for malformed set_details JSON', () => {
		expect(() => buildNormalized(editSugarwod(gummyWormSets, '"[{""rnds"":8,"'))).toThrow(
			/^sugarwod#row2 set_details: .*JSON/
		);
	});

	it('names the row for an integer in set_details beyond the exact range', () => {
		const root = editSugarwod('""rnds"":8', '""rnds"":9007199254740993');
		expect(() => buildNormalized(root)).toThrow(
			'sugarwod#row2 set_details: integer 9007199254740993 is outside the exact range'
		);
	});

	it.each([
		['NaN', /^curated\/sugarwod_snapshot_2026-11-17\.json: .*NaN/],
		['1e999', 'curated/sugarwod_snapshot_2026-11-17.json: number 1e999 is not finite']
	])('names the snapshot file for a %s lift load', (load, message) => {
		const root = dataCopy((file, text) => (file.includes('snapshot') ? text.replace('"2RM": 235', `"2RM": ${load}`) : text));
		expect(() => buildNormalized(root)).toThrow(message);
	});

	it('names the record for a curated score given as a number', () => {
		const root = editCuratedResult((first) => {
			first.score = 46;
		});
		expect(() => buildNormalized(root)).toThrow(
			'curated/results.json[0] (turkey-trot-triple 2019-11): score 46 is a number; scores must be strings'
		);
	});

	it('names the row for a SugarWOD date that is not m/d/Y', () => {
		const root = editSugarwod('03/31/2021,"Gummy worm"', '2021-03-31,"Gummy worm"');
		expect(() => buildNormalized(root)).toThrow('sugarwod#row2 date: "2021-03-31" is not a m/d/Y date');
	});
});

describe('SugarWOD score types', () => {
	it.each(['toString', 'constructor', '__proto__'])('treats the unknown score type %s as text', (scoreType) => {
		const files = buildNormalized(editSugarwod('"Rounds + Reps"', `"${scoreType}"`));
		const workouts = JSON.parse(files['workouts.json']) as { id: string; score: { type: string } }[];
		expect(workouts.find((workout) => workout.id === 'gummy-worm')?.score.type).toBe('text');
	});
});
