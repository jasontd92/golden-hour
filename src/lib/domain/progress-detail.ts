import type { Observation } from './evolution-chart.ts';
import type { LiftEvidence, Result, ScoreType, Workout } from './history.ts';
import {
	bestOneRepMax,
	bestResult,
	displayScore,
	liftHistory,
	liftName,
	resultHistory,
	type HistoryRow
} from './progress.ts';
import { formatScore } from './score.ts';
import { targetPoints, type TargetPoint } from './targets.ts';

export interface ProgressDetail {
	kind: 'benchmark' | 'lift';
	id: string;
	name: string;
	unit: string;
	scoreType: ScoreType;
	better: 'lower' | 'higher';
	best: string | undefined;
	latest: string | undefined;
	target: string | undefined;
	observations: Observation[];
	targets: TargetPoint[];
	history: HistoryRow[];
}

const unitNames: Record<ScoreType, string> = {
	time: 'time',
	load_lb: 'pounds',
	rounds_reps: 'rounds + reps',
	reps: 'reps',
	seconds: 'seconds',
	points: 'points',
	text: 'result',
	checkbox: 'result'
};

const midMonth = (date: string) => (date.length === 7 ? `${date}-15` : date);

function latestBefore(observations: readonly Observation[], date: string): Observation | undefined {
	return observations.filter((o) => o.date < date).at(-1);
}

export function benchmarkDetail(
	workout: Workout,
	results: readonly Result[],
	firstMonday: string
): ProgressDetail {
	const better = workout.score.better ?? 'higher';
	const observations = results
		.filter((r) => r.workout === workout.id && r.value !== undefined && r.date !== undefined && r.conflict === undefined)
		.map((r) => ({ date: midMonth(r.date ?? ''), value: r.value ?? 0 }))
		.toSorted((a, b) => a.date.localeCompare(b.date));
	const best = bestResult(workout, results).result;
	const latest = observations.at(-1);
	const baseline = latestBefore(observations, firstMonday);
	const targets = baseline ? targetPoints('benchmark', workout.id, baseline.value) : [];
	const format = (value: number) => formatScore(value, workout.score.type);
	return {
		kind: 'benchmark',
		id: workout.id,
		name: workout.name,
		unit: unitNames[workout.score.type],
		scoreType: workout.score.type,
		better,
		best: best ? displayScore(best, workout) : undefined,
		latest: latest ? format(latest.value) : undefined,
		target: targets.at(-1) ? format(targets.at(-1)?.value ?? 0) : undefined,
		observations,
		targets,
		history: resultHistory(workout, results)
	};
}

export function liftDetail(id: string, evidence: readonly LiftEvidence[], firstMonday: string): ProgressDetail {
	const observations = evidence
		.filter((e) => e.reps === 1 && e.date !== null)
		.map((e) => ({ date: e.date ?? '', value: e.load }))
		.toSorted((a, b) => a.date.localeCompare(b.date));
	const best = bestOneRepMax(evidence);
	const latest = observations.at(-1);
	const baseline = latestBefore(observations, firstMonday);
	const targets = baseline ? targetPoints('lift', id, baseline.value) : [];
	return {
		kind: 'lift',
		id,
		name: liftName(id),
		unit: 'pounds',
		scoreType: 'load_lb',
		better: 'higher',
		best: best === undefined ? undefined : String(best),
		latest: latest ? String(latest.value) : undefined,
		target: targets.at(-1) ? String(targets.at(-1)?.value) : undefined,
		observations,
		targets,
		history: liftHistory(evidence)
	};
}
