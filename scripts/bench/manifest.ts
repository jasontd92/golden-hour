import { z } from 'zod';
import type { BugClass, Split } from './catalog.ts';

export const plantStatuses = ['planted', 'caught-by-machine', 'not-planted'] as const;

const hunk = z.object({ file: z.string(), start: z.number().int(), end: z.number().int() });

const plant = z.object({
	classId: z.string(),
	split: z.enum(['tuning', 'held-out']),
	status: z.enum(plantStatuses),
	how: z.enum(['agent', 'mechanical']),
	reason: z.string().optional(),
	behavior: z.string(),
	markers: z.array(z.string()),
	cover: z.object({ title: z.string(), claims: z.array(z.string()) }),
	files: z.array(z.string()),
	hunks: z.array(hunk),
	diff: z.string(),
	gateLog: z.string().optional()
});

export const manifestSchema = z.object({
	runId: z.string(),
	baseSha: z.string(),
	createdAt: z.string(),
	dryRun: z.boolean(),
	plants: z.array(plant)
});

export type Hunk = z.infer<typeof hunk>;
export type Plant = z.infer<typeof plant>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(text: string): Manifest {
	return manifestSchema.parse(JSON.parse(text));
}

export function changedFiles(diff: string): string[] {
	const files = [...diff.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map((match) => match[2]!);
	return [...new Set(files)];
}

export function addedHunks(diff: string): Hunk[] {
	const hunks: Hunk[] = [];
	let file: string | null = null;
	for (const line of diff.split('\n')) {
		const target = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(line);
		if (target) {
			file = target[1] ?? null;
			continue;
		}
		const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
		if (header && file !== null) {
			const start = Number(header[1]);
			const length = header[2] === undefined ? 1 : Number(header[2]);
			hunks.push({ file, start, end: start + Math.max(length, 1) - 1 });
		}
	}
	return hunks;
}

function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j]!, copy[i]!];
	}
	return copy;
}

export function sampleClasses(classes: readonly BugClass[], count: number, seed: number): BugClass[] {
	const random = mulberry32(seed);
	const bySplit = (split: Split) => shuffled(classes.filter((bugClass) => bugClass.split === split), random);
	const queues = [bySplit('held-out'), bySplit('tuning')];
	if (random() < 0.5) queues.reverse();
	const picked: BugClass[] = [];
	while (picked.length < Math.min(count, classes.length)) {
		const preferred = queues[picked.length % 2]!;
		const queue = preferred.length > 0 ? preferred : queues[(picked.length + 1) % 2]!;
		picked.push(queue.shift()!);
	}
	return picked;
}
