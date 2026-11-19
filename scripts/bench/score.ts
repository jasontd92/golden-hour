import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Split } from './catalog.ts';
import { lastJsonBlock } from './json-block.ts';
import { parseManifest, type Manifest, type Plant } from './manifest.ts';

const findingSchema = z.object({
	file: z.string().nullish(),
	line: z.number().int().nullish(),
	behavior: z.string()
});

export type Finding = z.infer<typeof findingSchema>;

export const lineSlack = 8;
export const minMarkerLength = 4;

export function parseFindings(verdict: string): Finding[] | null {
	return lastJsonBlock(verdict, z.object({ findings: z.array(findingSchema) }))?.findings ?? null;
}

export function normalizePath(reported: string): { file: string; line: number | null } {
	const cleaned = reported.trim().replace(/^`|`$/g, '');
	const located = /^(.*?):(\d+)(?::\d+)?$/.exec(cleaned);
	const file = (located ? located[1]! : cleaned).replace(/^(?:\.\/|[ab]\/)/, '');
	return { file, line: located ? Number(located[2]) : null };
}

const sameFile = (reported: string, planted: string) => reported === planted || reported.endsWith(`/${planted}`);

export function catches(finding: Finding, plant: Plant): boolean {
	const text = `${finding.file ?? ''} ${finding.behavior}`.toLowerCase();
	const markerHit = plant.markers.some((marker) => marker.length >= minMarkerLength && text.includes(marker.toLowerCase()));
	if (!finding.file) return markerHit;
	const reported = normalizePath(finding.file);
	const file = plant.files.find((planted) => sameFile(reported.file, planted));
	if (file === undefined) return false;
	const line = finding.line ?? reported.line;
	if (line === null) return true;
	const lineHit = plant.hunks.some((hunk) => hunk.file === file && line >= hunk.start - lineSlack && line <= hunk.end + lineSlack);
	return lineHit || markerHit;
}

export type Outcome = 'caught' | 'missed' | 'caught-by-machine' | 'not-planted';

export interface PlantScore {
	classId: string;
	split: Split;
	outcome: Outcome;
	reason?: string;
}

export interface Recall {
	caught: number;
	planted: number;
}

export interface RunScore {
	verdictParsed: boolean;
	plants: PlantScore[];
	recall: Record<Split | 'overall', Recall>;
	otherFindings: number;
}

export function scoreRun(manifest: Manifest, verdict: string | null): RunScore {
	const findings = verdict === null ? null : parseFindings(verdict);
	const matched = new Set<Finding>();
	const plants = manifest.plants.map((plant): PlantScore => {
		if (plant.status !== 'planted') {
			const outcome = plant.status;
			return plant.reason === undefined ? { classId: plant.classId, split: plant.split, outcome } : { classId: plant.classId, split: plant.split, outcome, reason: plant.reason };
		}
		const hits = (findings ?? []).filter((finding) => catches(finding, plant));
		for (const hit of hits) matched.add(hit);
		return { classId: plant.classId, split: plant.split, outcome: hits.length > 0 ? 'caught' : 'missed' };
	});
	const recall = (split?: Split): Recall => {
		const scored = plants.filter((plant) => (split === undefined || plant.split === split) && (plant.outcome === 'caught' || plant.outcome === 'missed'));
		return { caught: scored.filter((plant) => plant.outcome === 'caught').length, planted: scored.length };
	};
	return {
		verdictParsed: findings !== null,
		plants,
		recall: { tuning: recall('tuning'), 'held-out': recall('held-out'), overall: recall() },
		otherFindings: (findings ?? []).filter((finding) => !matched.has(finding)).length
	};
}

const ratio = ({ caught, planted }: Recall) => (planted === 0 ? 'n/a' : `${caught}/${planted} (${Math.round((100 * caught) / planted)}%)`);

export function formatScore(score: RunScore): string {
	const width = Math.max(5, ...score.plants.map((plant) => plant.classId.length));
	const rows = score.plants.map(
		(plant) => `${plant.classId.padEnd(width)}  ${plant.split.padEnd(8)}  ${plant.outcome}${plant.reason ? ` (${plant.reason})` : ''}`
	);
	const named = (outcome: Outcome) => score.plants.filter((plant) => plant.outcome === outcome).map((plant) => plant.classId);
	return [
		`${'class'.padEnd(width)}  split     outcome`,
		...rows,
		'',
		`recall: tuning ${ratio(score.recall.tuning)} · held-out ${ratio(score.recall['held-out'])} · overall ${ratio(score.recall.overall)}`,
		`caught: ${named('caught').join(', ') || 'none'}`,
		`missed: ${named('missed').join(', ') || 'none'}`,
		`caught by machine: ${named('caught-by-machine').join(', ') || 'none'}`,
		...(score.verdictParsed || score.recall.overall.planted === 0 ? [] : ['verdict had no parseable findings block: every planted bug counts as missed']),
		`other findings (not matched to a plant): ${score.otherFindings}`
	].join('\n');
}

if (import.meta.main) {
	const runDir = process.argv[2];
	if (!runDir) {
		console.error('usage: node scripts/bench/score.ts <run dir holding manifest.json and verdict.md>');
		process.exit(2);
	}
	const manifest = parseManifest(readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
	console.log(formatScore(scoreRun(manifest, readFileSync(path.join(runDir, 'verdict.md'), 'utf8'))));
}
