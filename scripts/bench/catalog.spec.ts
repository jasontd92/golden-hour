import { describe, expect, it } from 'vitest';
import { catalog, catalogProblems, type BugClass } from './catalog.ts';

const valid: BugClass = catalog[0]!;

describe('bug catalog', () => {
	it('is valid: unique kebab ids, known threats, both splits populated', () => {
		expect(catalogProblems(catalog)).toEqual([]);
		expect(catalog.length).toBeGreaterThanOrEqual(10);
	});

	it('splits into tuning and held-out classes', () => {
		const heldOut = catalog.filter((bugClass) => bugClass.split === 'held-out').map((bugClass) => bugClass.id);
		expect(heldOut).toEqual(['build-date-dependency', 'e2e-ack-not-storage', 'week-index-off-by-one', 'swallowed-error', 'weakened-test-guard']);
	});

	it('rejects duplicates, bad ids, unknown threats and thin instructions', () => {
		const broken: BugClass[] = [
			valid,
			{ ...valid },
			{ ...valid, id: 'Bad_Id' },
			{ ...valid, id: 'thin-plant', plant: 'break it' },
			{ ...valid, id: 'odd-threat', threatens: 'vibes' as BugClass['threatens'] },
			{ ...valid, id: 'no-source', minedFrom: ' ' }
		];
		const problems = catalogProblems(broken);
		expect(problems).toContain(`${valid.id}: duplicate id`);
		expect(problems).toContain('Bad_Id: id must be kebab-case with at least two words');
		expect(problems).toContain('thin-plant: planting instruction is too short to apply to new code');
		expect(problems).toContain('odd-threat: unknown threat vibes');
		expect(problems).toContain('no-source: name the verifier finding it was mined from');
		expect(problems.some((problem) => problem.startsWith('each split needs at least 3 classes'))).toBe(true);
	});
});
