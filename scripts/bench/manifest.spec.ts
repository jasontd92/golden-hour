import { describe, expect, it } from 'vitest';
import { catalog } from './catalog.ts';
import { addedHunks, changedFiles, parseManifest, sampleClasses, type Manifest } from './manifest.ts';

const diff = `diff --git a/src/lib/domain/strength.ts b/src/lib/domain/strength.ts
index 1111111..2222222 100644
--- a/src/lib/domain/strength.ts
+++ b/src/lib/domain/strength.ts
@@ -2 +2 @@ export const plateStepLb = 5;
-export const trainingMaxPct = 0.85;
+export const trainingMaxPct = 0.9;
@@ -40,3 +40,5 @@ export function wendlerSet() {
+	a;
+	b;
diff --git a/e2e/new.e2e.ts b/e2e/new.e2e.ts
new file mode 100644
--- /dev/null
+++ b/e2e/new.e2e.ts
@@ -0,0 +1,3 @@
+one
+two
+three
diff --git a/e2e/gone.e2e.ts b/e2e/gone.e2e.ts
deleted file mode 100644
--- a/e2e/gone.e2e.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-x
-y
`;

describe('plant diffs', () => {
	it('lists changed files once each', () => {
		expect(changedFiles(diff)).toEqual(['src/lib/domain/strength.ts', 'e2e/new.e2e.ts', 'e2e/gone.e2e.ts']);
	});

	it('maps hunks to new-side line ranges and skips deleted files', () => {
		expect(addedHunks(diff)).toEqual([
			{ file: 'src/lib/domain/strength.ts', start: 2, end: 2 },
			{ file: 'src/lib/domain/strength.ts', start: 40, end: 44 },
			{ file: 'e2e/new.e2e.ts', start: 1, end: 3 }
		]);
	});
});

describe('class sampling', () => {
	it('is reproducible for a seed', () => {
		expect(sampleClasses(catalog, 4, 7).map((c) => c.id)).toEqual(sampleClasses(catalog, 4, 7).map((c) => c.id));
	});

	it('alternates splits so a 2-class run tests both', () => {
		for (const seed of [1, 2, 3, 99, 12345]) {
			const splits = sampleClasses(catalog, 2, seed).map((c) => c.split);
			expect(new Set(splits)).toEqual(new Set(['tuning', 'held-out']));
		}
	});

	it('never repeats a class and caps at the catalog size', () => {
		const all = sampleClasses(catalog, 50, 5).map((c) => c.id);
		expect(all).toHaveLength(catalog.length);
		expect(new Set(all).size).toBe(catalog.length);
	});
});

describe('manifest', () => {
	it('round-trips through JSON and rejects unknown statuses', () => {
		const manifest: Manifest = {
			runId: 'r',
			baseSha: 'abc',
			createdAt: '2026-11-18T00:00:00.000Z',
			dryRun: true,
			plants: [
				{
					classId: 'vacuous-assertion',
					split: 'tuning',
					status: 'planted',
					how: 'mechanical',
					behavior: 'b',
					markers: [],
					cover: { title: 't', claims: ['c'] },
					files: ['f'],
					hunks: [{ file: 'f', start: 1, end: 1 }],
					diff: ''
				}
			]
		};
		expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest);
		expect(() => parseManifest(JSON.stringify({ ...manifest, plants: [{ ...manifest.plants[0], status: 'maybe' }] }))).toThrow();
	});
});
