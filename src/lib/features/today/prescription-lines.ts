import type { Block, MovementWork, PercentSet, Prescription } from '#lib/domain/plan.ts';
import { wendlerSet } from '#lib/domain/strength.ts';
import { movementLabels } from '#lib/ui/movement-labels.ts';
import type { MovementId } from '#lib/domain/movements.ts';

export type LineTone = 'plain' | 'quiet' | 'strong';

export interface Line {
	text: string;
	tone: LineTone;
}

const plain = (text: string): Line => ({ text, tone: 'plain' });
const quiet = (text: string): Line => ({ text, tone: 'quiet' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const label = (movement: MovementId, count: number) => movementLabels[movement][count === 1 ? 0 : 1];

export function movementLine(work: MovementWork): string {
	const name = movementLabels[work.movement][0];
	const amount =
		'reps' in work
			? `${work.reps} ${label(work.movement, work.reps)}`
			: 'meters' in work
				? `${work.meters} m ${name}`
				: 'calories' in work
					? `${work.calories} cal ${name}`
					: `${work.seconds} s ${name}`;
	const load = work.load === undefined ? '' : `, ${work.load} lb`;
	const height = work.heightInches === undefined ? '' : `, ${work.heightInches}"`;
	return amount + load + height;
}

const sameSet = (a: PercentSet, b: PercentSet) => a.pct === b.pct && a.reps === b.reps && a.amrap === b.amrap;

function percentSetLines(trainingMax: number, sets: PercentSet[]): Line[] {
	const [first] = sets;
	if (first && sets.length > 1 && !first.amrap && sets.every((set) => sameSet(set, first))) {
		return [plain(`${sets.length} × ${first.reps} at ${wendlerSet(trainingMax, first.pct)}`)];
	}
	return sets.map((set) => {
		const text = `${wendlerSet(trainingMax, set.pct)} × ${set.reps}`;
		return set.amrap ? { text: `${text}+`, tone: 'strong' } : plain(text);
	});
}

function schemeHeader(p: Prescription): string | undefined {
	switch (p.kind) {
		case 'amrap':
			return `AMRAP ${p.minutes}`;
		case 'emom':
			return `EMOM ${p.minutes}`;
		case 'forTime': {
			const scheme = p.rounds === 1 ? 'For time' : `${p.rounds} rounds for time`;
			return p.timeCapMinutes === undefined ? scheme : `${scheme} · ${p.timeCapMinutes} min cap`;
		}
		case 'intervals':
			return p.restSeconds === 0 ? `${p.rounds} rounds` : `${p.rounds} rounds · ${p.restSeconds} s rest`;
		default:
			return undefined;
	}
}

function prescriptionLines(p: Prescription, blockName: string): Line[] {
	switch (p.kind) {
		case 'percentSets':
			return percentSetLines(p.trainingMax, p.sets);
		case 'fixedSets': {
			const load = p.load === undefined ? '' : ` at ${p.load}`;
			return [plain(`${capitalize(label(p.movement, p.reps))} ${p.sets} × ${p.reps}${load}`)];
		}
		case 'steady':
			return [plain(`${p.minutes} min ${movementLabels[p.movement][0]}`)];
		case 'freeText':
			return [quiet(p.text)];
		case 'amrap':
		case 'emom':
		case 'forTime':
		case 'intervals': {
			const header = schemeHeader(p);
			const lines = p.movements.map((work) => plain(movementLine(work)));
			return header && header !== blockName ? [quiet(header), ...lines] : lines;
		}
	}
}

export function blockLines(block: Block): Line[] {
	const lines = block.prescriptions.flatMap((p) => prescriptionLines(p, block.name));
	return block.notes ? [...lines, quiet(block.notes)] : lines;
}
