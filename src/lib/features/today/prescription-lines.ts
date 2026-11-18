import type { DayLog } from '#lib/domain/log.ts';
import type { Block, MovementWork, PercentSet, Prescription } from '#lib/domain/plan.ts';
import { formatScore } from '#lib/domain/score.ts';
import { wendlerSet } from '#lib/domain/strength.ts';
import { movementLabels } from '#lib/ui/movement-labels.ts';
import type { MovementId } from '#lib/domain/movements.ts';

export type LineTone = 'plain' | 'quiet' | 'strong';

export interface LinePosition {
	prescriptionIndex: number;
	setIndexes: number[];
}

export interface Line {
	text: string;
	tone: LineTone;
	at?: LinePosition;
}

const plain = (text: string): Line => ({ text, tone: 'plain' });
const quiet = (text: string): Line => ({ text, tone: 'quiet' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const label = (movement: MovementId, count: number) => movementLabels[movement][count === 1 ? 0 : 1];

const metersPerMile = 1609.344;

export function distance(meters: number): string {
	const miles = Math.round(meters / metersPerMile);
	if (miles >= 1 && Math.abs(miles * metersPerMile - meters) < 1) return `${miles} mi`;
	return meters >= 1000 && meters % 1000 === 0 ? `${meters / 1000} km` : `${meters} m`;
}

export const duration = (seconds: number) => (seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`);

export function movementLine(work: MovementWork): string {
	const name = movementLabels[work.movement][0];
	const amount =
		'reps' in work
			? `${work.reps} ${label(work.movement, work.reps)}`
			: 'meters' in work
				? `${distance(work.meters)} ${name}`
				: 'calories' in work
					? `${work.calories} cal ${name}`
					: `${duration(work.seconds)} ${name}`;
	const load = work.load === undefined ? '' : `, ${work.load} lb`;
	const height = work.heightInches === undefined ? '' : `, ${work.heightInches}"`;
	return amount + load + height;
}

const sameSet = (a: PercentSet, b: PercentSet) => a.pct === b.pct && a.reps === b.reps && a.amrap === b.amrap;

const indexes = (count: number) => Array.from({ length: count }, (_, i) => i);

function percentSetLines(trainingMax: number, sets: PercentSet[], prescriptionIndex: number): Line[] {
	const [first] = sets;
	if (first && sets.length > 1 && !first.amrap && sets.every((set) => sameSet(set, first))) {
		const text = `${sets.length} × ${first.reps} at ${wendlerSet(trainingMax, first.pct)}`;
		return [{ ...plain(text), at: { prescriptionIndex, setIndexes: indexes(sets.length) } }];
	}
	return sets.map((set, setIndex) => {
		const text = `${wendlerSet(trainingMax, set.pct)} × ${set.reps}`;
		const at = { prescriptionIndex, setIndexes: [setIndex] };
		return set.amrap ? { text: `${text}+`, tone: 'strong', at } : { ...plain(text), at };
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
			if (p.restSeconds === 0) return p.rounds === 1 ? undefined : `${p.rounds} rounds`;
			return `${p.rounds} rounds · ${duration(p.restSeconds)} rest`;
		default:
			return undefined;
	}
}

function prescriptionLines(p: Prescription, blockName: string, prescriptionIndex: number): Line[] {
	switch (p.kind) {
		case 'percentSets':
			return percentSetLines(p.trainingMax, p.sets, prescriptionIndex);
		case 'fixedSets': {
			const load = p.load === undefined ? '' : ` at ${p.load}`;
			const text = `${capitalize(label(p.movement, p.reps))} ${p.sets} × ${p.reps}${load}`;
			return [{ ...plain(text), at: { prescriptionIndex, setIndexes: indexes(p.sets) } }];
		}
		case 'maxReps':
			return [{ ...plain(`Max ${label(p.movement, 2)}`), at: { prescriptionIndex, setIndexes: [0] } }];
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
			const [first, ...rest] = header && header !== blockName ? [quiet(header), ...lines] : lines;
			return first ? [{ ...first, at: { prescriptionIndex, setIndexes: [] } }, ...rest] : [];
		}
	}
}

export function blockLines(block: Block): Line[] {
	const lines = block.prescriptions.flatMap((p, i) => prescriptionLines(p, block.name, i));
	return block.notes ? [...lines, quiet(block.notes)] : lines;
}

export function loggedText(line: Line, blockIndex: number, log: DayLog): string | undefined {
	if (!line.at) return undefined;
	const { prescriptionIndex, setIndexes } = line.at;
	const score = log.session?.score;
	if (setIndexes.length === 0) {
		const scored = score?.blockIndex === blockIndex && score.prescriptionIndex === prescriptionIndex;
		return score && scored ? `✓ ${formatScore(score.value, score.type)}` : undefined;
	}
	const reps = setIndexes.flatMap((setIndex) => {
		const set = log.sets.findLast(
			(r) => r.blockIndex === blockIndex && r.prescriptionIndex === prescriptionIndex && r.setIndex === setIndex
		);
		return set ? [set.reps] : [];
	});
	return reps.length > 0 ? `✓ ${reps.join('/')}` : undefined;
}
