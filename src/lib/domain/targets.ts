export type TargetChange = { add: number } | { scale: number };

export interface TargetStep {
	week: number;
	change: TargetChange;
}

export interface ProgressTarget {
	kind: 'benchmark' | 'lift';
	id: string;
	steps: readonly TargetStep[];
}

const at = (week: number, change: TargetChange): TargetStep => ({ week, change });

// why: team/draft-plan.md § G "End targets"; the mile target needs a mile baseline, which doesn't exist yet.
export const evolutionTargets: readonly ProgressTarget[] = [
	{ kind: 'benchmark', id: 'crossfit-total', steps: [at(16, { add: 50 })] },
	{ kind: 'lift', id: 'back-squat', steps: [at(16, { add: 20 })] },
	{ kind: 'lift', id: 'deadlift', steps: [at(16, { add: 20 })] },
	{ kind: 'lift', id: 'shoulder-press', steps: [at(16, { add: 10 })] },
	{ kind: 'benchmark', id: 'run-10k', steps: [at(17, { scale: 0.95 })] },
	{
		kind: 'benchmark',
		id: 'strict-pullups-max',
		steps: [at(4, { add: 1 }), at(8, { add: 3 }), at(12, { add: 5 }), at(16, { add: 7 })]
	}
];

export interface TargetPoint {
	week: number;
	value: number;
}

const applied = (baseline: number, change: TargetChange) =>
	'add' in change ? baseline + change.add : Math.round(baseline * change.scale);

export function targetPoints(kind: ProgressTarget['kind'], id: string, baseline: number): TargetPoint[] {
	const target = evolutionTargets.find((t) => t.kind === kind && t.id === id);
	return (target?.steps ?? []).map((step) => ({ week: step.week, value: applied(baseline, step.change) }));
}
