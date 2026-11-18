import { planWeeks } from './plan.ts';
import type { TargetPoint } from './targets.ts';

export interface Observation {
	date: string;
	value: number;
}

export interface WeekValue {
	week: number;
	value: number;
}

export interface EvolutionChartInput {
	better: 'lower' | 'higher';
	observations: readonly Observation[];
	targets: readonly TargetPoint[];
	trainingMaxes: readonly WeekValue[];
	firstMonday: string;
	today: string;
}

export interface EvolutionChart {
	logged: WeekValue[];
	plan: WeekValue[];
	targets: WeekValue[];
	ticks: number[];
	domain: [low: number, high: number];
	upIsBetter: boolean;
	todayWeek: number | undefined;
}

const msPerWeek = 7 * 86_400_000;

export function weeksSince(firstMonday: string, date: string): number {
	return (Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${firstMonday}T00:00:00Z`)) / msPerWeek;
}

function niceStep(span: number): number {
	const raw = span / 2;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	return ([1, 2, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude;
}

function ticksFor(values: readonly number[]): { ticks: number[]; domain: [number, number] } {
	const low = Math.min(...values);
	const high = Math.max(...values);
	const step = niceStep(Math.max(high - low, Math.abs(high) * 0.1, 1));
	const first = Math.floor(low / step) * step;
	const last = Math.ceil(high / step) * step;
	const ticks: number[] = [];
	for (let t = first; t <= last + step / 2; t += step) ticks.push(t);
	return { ticks, domain: [first, last] };
}

function stepLine(trainingMaxes: readonly WeekValue[]): WeekValue[] {
	return trainingMaxes.flatMap(({ week, value }) => [
		{ week: week - 1, value },
		{ week, value }
	]);
}

export function evolutionChart(input: EvolutionChartInput): EvolutionChart | undefined {
	const dated = input.observations
		.map((o) => ({ week: weeksSince(input.firstMonday, o.date), value: o.value, date: o.date }))
		.toSorted((a, b) => a.date.localeCompare(b.date));
	const before = dated.filter((o) => o.week < 0);
	const during = dated.filter((o) => o.week >= 0 && o.week <= planWeeks);
	const start = before.at(-1);
	const logged = [...(start ? [{ week: 0, value: start.value }] : []), ...during.map(({ week, value }) => ({ week, value }))];
	const last = logged.at(-1);
	const targets = input.targets.map(({ week, value }) => ({ week, value }));
	const plan =
		input.trainingMaxes.length > 0
			? stepLine(input.trainingMaxes)
			: last && targets.length > 0
				? [last, ...targets.filter((t) => t.week > last.week)]
				: [];
	const values = [...logged, ...plan, ...targets].map((p) => p.value);
	if (values.length === 0) return undefined;
	const todayWeek = weeksSince(input.firstMonday, input.today);
	return {
		logged,
		plan,
		targets,
		...ticksFor(values),
		upIsBetter: input.better === 'higher',
		todayWeek: todayWeek >= 0 && todayWeek <= planWeeks ? todayWeek : undefined
	};
}

export function chartY(chart: Pick<EvolutionChart, 'domain' | 'upIsBetter'>, value: number, height: number): number {
	const [low, high] = chart.domain;
	const share = high === low ? 0.5 : (value - low) / (high - low);
	return chart.upIsBetter ? height - share * height : share * height;
}

export const chartX = (week: number, width: number) => (week / planWeeks) * width;
