import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileMatchPattern, movementIds, movementTaggers, MovementVocabulary, summarizeTags, tagMovements } from './movements.ts';

it('movementIds mirror data/curated/movements.json in order', () => {
	const curated: { movements: { id: string }[] } = JSON.parse(
		readFileSync(new URL('../../../data/curated/movements.json', import.meta.url), 'utf8')
	);
	expect([...movementIds]).toStrictEqual(curated.movements.map((m) => m.id));
});

describe('tagMovements reproduces the Python tagger', () => {
	const vocabulary = MovementVocabulary.parse(
		JSON.parse(readFileSync(new URL('../../../data/curated/movements.json', import.meta.url), 'utf8'))
	).movements;
	const taggers = movementTaggers(vocabulary);

	it.each([
		['Squat Clean and Jerk, then power cleans', ['squat_clean', 'power_clean', 'jerk']],
		['Clean & Jerk', ['power_clean', 'jerk']],
		['hip dips and ring dips', ['dip']],
		['Deadlift high pull', ['sdhp']],
		['5 rounds: 400m run, 10 pull-ups', ['pull_up', 'run']],
		['rowing 500m row', ['row']],
		['ärun run', ['run']],
		['Thrusterä', []],
		['DUs and MUs', ['muscle_up', 'double_under']],
		['snatches (95 lb)', ['db_snatch']],
		['🍫 burpees', ['burpee']],
		['', []]
	])('%s', (text, expected) => {
		expect(tagMovements(text, taggers)).toStrictEqual(expected);
	});

	it('summarizes patterns, modality in MGW order and home availability', () => {
		expect(summarizeTags(['run', 'thruster'], vocabulary)).toStrictEqual({
			patterns: ['locomotion', 'push_v', 'squat'],
			modality: 'MW',
			homeOk: true
		});
		expect(summarizeTags([], vocabulary)).toStrictEqual({ patterns: [], modality: '', homeOk: null });
	});
});

describe('compileMatchPattern', () => {
	it('makes \\b and \\d Unicode-aware like Python re', () => {
		expect(compileMatchPattern('\\brun\\b').test(' ärun ')).toBe(false);
		expect(compileMatchPattern('\\d+ ?m').test('٤٠٠m')).toBe(true);
	});

	it('rejects escapes it cannot translate', () => {
		expect(() => compileMatchPattern('\\s')).toThrow(/unsupported/);
	});
});
