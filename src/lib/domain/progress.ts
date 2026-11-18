import type { LiftEvidence, LiftsFile, Result, Workout } from './history.ts';
import { formatScore } from './score.ts';

export interface ProgressRow {
	id: string;
	name: string;
	best: string;
	conflicted: boolean;
}

export interface HistoryRow {
	date: string;
	score: string;
	source: string;
	conflict?: string;
}

export interface BestResult {
	result: Result | undefined;
	conflicted: boolean;
}

type Better = 'lower' | 'higher';
type Scored = Result & { value: number };

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isScored(result: Result): result is Scored {
	return result.value !== undefined;
}

function atLeastAsGood(a: number, b: number, better: Better): boolean {
	return better === 'lower' ? a <= b : a >= b;
}

function byDateAscending(a: Result, b: Result): number {
	return (a.date ?? '￿').localeCompare(b.date ?? '￿');
}

export function bestResult(workout: Workout, results: readonly Result[]): BestResult {
	const better = workout.score.better;
	if (!better) return { result: undefined, conflicted: false };
	const scored = results
		.filter((r): r is Scored => r.workout === workout.id && isScored(r))
		.sort(byDateAscending);
	let best: Scored | undefined;
	for (const result of scored) {
		if (result.conflict !== undefined) continue;
		if (!best || (result.value !== best.value && atLeastAsGood(result.value, best.value, better))) best = result;
	}
	const conflicted = scored.some(
		(r) => r.conflict !== undefined && (!best || atLeastAsGood(r.value, best.value, better))
	);
	return { result: best, conflicted };
}

export function displayScore(result: Result, workout: Workout): string {
	if (result.score_display !== undefined) return result.score_display;
	if (result.value !== undefined) return formatScore(result.value, workout.score.type);
	return '—';
}

function resultCount(workout: Workout, results: readonly Result[]): number {
	return results.filter((r) => r.workout === workout.id && isScored(r)).length;
}

function isComparable(workout: Workout): boolean {
	return workout.score.better !== null && workout.definition_status === undefined;
}

export function benchmarkWorkouts(workouts: readonly Workout[], results: readonly Result[]): Workout[] {
	const count = new Map(workouts.map((w) => [w.id, resultCount(w, results)]));
	const datedCount = (w: Workout) =>
		results.filter((r) => r.workout === w.id && isScored(r) && r.date !== undefined).length;
	const groups: ((w: Workout) => boolean)[] = [
		(w) => w.favorite === true,
		(w) => w.kind === 'test',
		(w) => w.kind === 'girl' && datedCount(w) >= 2
	];
	const chosen = new Set<string>();
	const ordered: Workout[] = [];
	for (const inGroup of groups) {
		const members = workouts
			.filter((w) => !chosen.has(w.id) && isComparable(w) && (count.get(w.id) ?? 0) > 0 && inGroup(w))
			.sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.name.localeCompare(b.name));
		for (const w of members) {
			chosen.add(w.id);
			ordered.push(w);
		}
	}
	return ordered;
}

export function benchmarkRows(workouts: readonly Workout[], results: readonly Result[]): ProgressRow[] {
	return benchmarkWorkouts(workouts, results).flatMap((workout) => {
		const { result, conflicted } = bestResult(workout, results);
		if (!result) return [];
		return [{ id: workout.id, name: workout.name, best: displayScore(result, workout), conflicted }];
	});
}

export function bestOneRepMax(evidence: readonly LiftEvidence[]): number | undefined {
	const loads = evidence.filter((e) => e.reps === 1).map((e) => e.load);
	return loads.length > 0 ? Math.max(...loads) : undefined;
}

export function liftName(slug: string): string {
	const words = slug.replaceAll('-', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function liftRows(lifts: LiftsFile): ProgressRow[] {
	return Object.entries(lifts)
		.flatMap(([id, evidence]) => {
			const best = bestOneRepMax(evidence);
			return best === undefined ? [] : [{ id, name: liftName(id), load: best }];
		})
		.sort((a, b) => b.load - a.load || a.name.localeCompare(b.name))
		.map(({ id, name, load }) => ({ id, name, best: String(load), conflicted: false }));
}

function dayLabel(iso: string): string {
	const [year, month, day] = iso.split('-');
	return `${months[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function monthLabel(iso: string): string {
	const [year, month] = iso.split('-');
	return `${months[Number(month) - 1]} ${year}`;
}

export function dateLabel(result: Pick<Result, 'date' | 'date_precision' | 'date_text'>): string {
	const { date, date_precision: precision } = result;
	if (precision === 'unknown' || date === undefined) return result.date_text ?? 'Undated';
	if (precision === 'month') return monthLabel(date);
	if (precision === 'approx') return `~${dayLabel(date)}`;
	return dayLabel(date);
}

const sourcePrefixes: [prefix: string, label: string][] = [
	['sugarwod-snapshot', 'SugarWOD profile'],
	['sugarwod', 'SugarWOD'],
	['google-sheet', 'Sheet'],
	['apple-notes', 'Notes']
];

export function sourceLabel(source: string): string {
	return sourcePrefixes.find(([prefix]) => source.startsWith(prefix))?.[1] ?? source;
}

function byDateDescending(a: { date?: string | null }, b: { date?: string | null }): number {
	if (!a.date) return b.date ? 1 : 0;
	if (!b.date) return -1;
	return b.date.localeCompare(a.date);
}

export function resultHistory(workout: Workout, results: readonly Result[]): HistoryRow[] {
	return results
		.filter((r) => r.workout === workout.id)
		.sort(byDateDescending)
		.map((r) => ({
			date: dateLabel(r),
			score: displayScore(r, workout),
			source: sourceLabel(r.source),
			...(r.conflict === undefined ? {} : { conflict: r.conflict })
		}));
}

export function liftHistory(evidence: readonly LiftEvidence[]): HistoryRow[] {
	return [...evidence].sort(byDateDescending).map((e) => ({
		date: e.date ? dayLabel(e.date) : 'Undated',
		score: e.reps === null ? String(e.load) : `${e.load} × ${e.reps}`,
		source: sourceLabel(e.source)
	}));
}
