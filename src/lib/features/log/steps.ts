import type { LogRecord } from '#lib/domain/log.ts';
import type { MovementId } from '#lib/domain/movements.ts';
import type { PercentSet, PlanSession, Prescription } from '#lib/domain/plan.ts';
import { wendlerSet } from '#lib/domain/strength.ts';
import { movementLabels } from '#lib/ui/movement-labels.ts';

export interface LogStep {
	blockIndex: number;
	prescriptionIndex: number;
	setIndex: number;
	setCount: number;
	movement: MovementId;
	load?: number;
	reps?: number;
	amrap: boolean;
	groupSummary: string;
}

type SetPosition = Pick<LogRecord, 'blockIndex' | 'prescriptionIndex' | 'setIndex'>;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const repsLabel = (movement: MovementId, reps: number) => movementLabels[movement][reps === 1 ? 0 : 1];
const loadedSet = (load: number, reps: number, amrap: boolean) => `${load} × ${reps}${amrap ? '+' : ''}`;

function percentSummary(trainingMax: number, sets: PercentSet[]): string {
	const [first] = sets;
	if (!first) return '';
	const uniform = sets.length > 1 && !first.amrap && sets.every((s) => s.pct === first.pct && s.reps === first.reps && !s.amrap);
	const load = wendlerSet(trainingMax, first.pct);
	return uniform ? `${sets.length} × ${first.reps} at ${load}` : loadedSet(load, first.reps, first.amrap);
}

function prescriptionSteps(p: Prescription, blockIndex: number, prescriptionIndex: number): LogStep[] {
	const at = { blockIndex, prescriptionIndex };
	switch (p.kind) {
		case 'percentSets': {
			const groupSummary = percentSummary(p.trainingMax, p.sets);
			return p.sets.map((set, setIndex) => ({
				...at,
				setIndex,
				setCount: p.sets.length,
				movement: p.lift,
				load: wendlerSet(p.trainingMax, set.pct),
				reps: set.reps,
				amrap: set.amrap,
				groupSummary
			}));
		}
		case 'fixedSets': {
			const load = p.load === undefined ? '' : ` at ${p.load}`;
			const groupSummary = `${capitalize(repsLabel(p.movement, p.reps))} ${p.sets} × ${p.reps}${load}`;
			return Array.from({ length: p.sets }, (_, setIndex) => ({
				...at,
				setIndex,
				setCount: p.sets,
				movement: p.movement,
				...(p.load === undefined ? {} : { load: p.load }),
				reps: p.reps,
				amrap: false,
				groupSummary
			}));
		}
		case 'maxReps':
			return [
				{ ...at, setIndex: 0, setCount: 1, movement: p.movement, amrap: true, groupSummary: `Max ${repsLabel(p.movement, 2)}` }
			];
		case 'amrap':
		case 'emom':
		case 'forTime':
		case 'intervals':
		case 'steady':
		case 'freeText':
			return [];
	}
}

export const logSteps = (session: PlanSession): LogStep[] =>
	session.blocks.flatMap((block, b) => block.prescriptions.flatMap((p, i) => prescriptionSteps(p, b, i)));

export const stepTitle = (step: LogStep) =>
	`${capitalize(movementLabels[step.movement][0])} · ${step.setIndex + 1} of ${step.setCount}`;

export const repsTarget = (step: LogStep) =>
	step.reps === undefined ? 'max reps' : `${step.reps}${step.amrap ? ' or more' : ''} ${step.reps === 1 ? 'rep' : 'reps'}`;

export function nextLabel(steps: readonly LogStep[], index: number): string | undefined {
	const next = steps[index + 1];
	if (!next) return undefined;
	if (next.setIndex === 0 || next.reps === undefined) return next.groupSummary;
	return next.load === undefined ? `${next.reps} ${repsLabel(next.movement, next.reps)}` : loadedSet(next.load, next.reps, next.amrap);
}

export const isAt = (record: SetPosition, step: SetPosition) =>
	record.blockIndex === step.blockIndex && record.prescriptionIndex === step.prescriptionIndex && record.setIndex === step.setIndex;

export function loggedAt(steps: readonly LogStep[], records: readonly LogRecord[]): (LogRecord | undefined)[] {
	return steps.map((step) => records.findLast((record) => isAt(record, step)));
}
