import { describe, expect, it } from 'vitest';
import { catalog } from './catalog.ts';
import { mechanicalPlanters, type RepoView } from './mechanical.ts';

const repo = (files: Record<string, string>): RepoView => ({ files: Object.keys(files), read: (file) => files[file]! });
const first = () => 0;

const plant = (id: string, files: Record<string, string>) => mechanicalPlanters[id]!(repo(files), first);

describe('mechanical planters', () => {
	it('exist only for catalog classes', () => {
		const ids = catalog.map((bugClass) => bugClass.id);
		for (const id of Object.keys(mechanicalPlanters)) expect(ids).toContain(id);
	});

	it('vacuous-assertion compares the subject with itself', () => {
		const planted = plant('vacuous-assertion', { 'src/lib/domain/a.spec.ts': "it('x', () => {\n\texpect(total).toBe(3);\n});" });
		expect(planted?.edits).toEqual([{ file: 'src/lib/domain/a.spec.ts', text: "it('x', () => {\n\texpect(total).toBe(total);\n});" }]);
		expect(planted?.markers).toEqual(['total']);
	});

	it('capped-generator cuts numRuns', () => {
		const planted = plant('capped-generator', { 'src/x.spec.ts': 'fc.assert(p, { numRuns: 1000 });' });
		expect(planted?.edits[0]?.text).toBe('fc.assert(p, { numRuns: 20 });');
	});

	it('mutant-tag-removed drops a tag the proof counts', () => {
		const planted = plant('mutant-tag-removed', {
			'scripts/sync-mutants.ts': "export const assertionTags = ['server', 'drain'] as const;",
			'src/s.spec.ts': "expect(rows, '[drain] all sent').toEqual([]);"
		});
		expect(planted?.edits[0]?.text).toBe("expect(rows, 'all sent').toEqual([]);");
	});

	it('plan-contradicts-rule moves the training-max percentage', () => {
		const planted = plant('plan-contradicts-rule', { 'src/lib/domain/strength.ts': 'export const trainingMaxPct = 0.85;' });
		expect(planted?.edits[0]?.text).toBe('export const trainingMaxPct = 0.90;');
	});

	it('weakened-test-guard adds or raises e2e retries', () => {
		const added = plant('weakened-test-guard', { 'playwright.config.ts': "export default defineConfig({\n\ttestDir: 'e2e'\n});" });
		expect(added?.edits[0]?.text).toBe("export default defineConfig({\n\tretries: 2,\n\ttestDir: 'e2e'\n});");
		const raised = plant('weakened-test-guard', { 'playwright.config.ts': 'defineConfig({\n\tretries: 1\n});' });
		expect(raised?.edits[0]?.text).toContain('retries: 3');
	});

	it('return null when the code no longer has a target, instead of planting something stale', () => {
		for (const planter of Object.values(mechanicalPlanters)) expect(planter(repo({ 'README.md': 'nothing here' }), first)).toBeNull();
	});
});
