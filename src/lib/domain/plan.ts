import { z } from 'zod';
import { MovementId } from './movements.ts';

export const planWeeks = 17;

const positiveInt = z.int().positive();
const loadLb = z.number().positive();

export const PercentSet = z.strictObject({
	pct: z.number().positive().max(1.1),
	reps: positiveInt,
	amrap: z.boolean()
});
export type PercentSet = z.infer<typeof PercentSet>;

const work = { movement: MovementId, load: loadLb.optional(), heightInches: z.number().positive().optional() };

export const MovementWork = z.union([
	z.strictObject({ ...work, reps: positiveInt }),
	z.strictObject({ ...work, meters: z.number().positive() }),
	z.strictObject({ ...work, calories: positiveInt }),
	z.strictObject({ ...work, seconds: positiveInt })
]);
export type MovementWork = z.infer<typeof MovementWork>;

const movements = z.array(MovementWork).min(1);

export const Prescription = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('percentSets'),
		lift: MovementId,
		trainingMax: loadLb,
		sets: z.array(PercentSet).min(1)
	}),
	z.strictObject({
		kind: z.literal('fixedSets'),
		movement: MovementId,
		sets: positiveInt,
		reps: positiveInt,
		load: loadLb.optional()
	}),
	z.strictObject({ kind: z.literal('maxReps'), movement: MovementId }),
	z.strictObject({ kind: z.literal('amrap'), minutes: positiveInt, movements }),
	z.strictObject({
		kind: z.literal('forTime'),
		rounds: positiveInt,
		timeCapMinutes: positiveInt.optional(),
		movements
	}),
	z.strictObject({ kind: z.literal('emom'), minutes: positiveInt, movements }),
	z.strictObject({
		kind: z.literal('intervals'),
		rounds: positiveInt,
		restSeconds: z.int().nonnegative(),
		movements
	}),
	z.strictObject({ kind: z.literal('steady'), movement: MovementId, minutes: positiveInt }),
	z.strictObject({ kind: z.literal('freeText'), text: z.string().min(1) })
]);
export type Prescription = z.infer<typeof Prescription>;
export type PrescriptionKind = Prescription['kind'];

export const BlockKind = z.enum(['warmup', 'strength', 'metcon', 'conditioning', 'skill', 'cooldown']);
export type BlockKind = z.infer<typeof BlockKind>;

export const Block = z.strictObject({
	name: z.string().min(1).max(40),
	kind: BlockKind,
	minutes: positiveInt,
	hard: z.boolean(),
	prescriptions: z.array(Prescription).min(1),
	notes: z.string().min(1).max(140).optional()
});
export type Block = z.infer<typeof Block>;

export const PlanSession = z.strictObject({
	date: z.iso.date(),
	week: z.int().min(1).max(planWeeks),
	title: z.string().min(1).max(40),
	why: z.string().min(1).max(280),
	location: z.enum(['home', 'rec']),
	blocks: z.array(Block).min(1)
});
export type PlanSession = z.infer<typeof PlanSession>;

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

const isOneWeek = (sessions: PlanSession[]) => {
	const days = sessions.map((s) => dayNumber(s.date));
	const first = days[0] ?? 0;
	return days.every((day, i) => i === 0 || day > (days[i - 1] ?? day)) && (days.at(-1) ?? first) - first < 7;
};

export const PlanWeek = z
	.array(PlanSession)
	.min(1)
	.max(7)
	.refine((sessions) => sessions.every((s) => s.week === sessions[0]?.week), {
		message: 'every session in a week file has the same week number'
	})
	.refine(isOneWeek, { message: 'sessions are in date order, at most one per day, within seven days' });
export type PlanWeek = z.infer<typeof PlanWeek>;

export const sessionMinutes = (session: PlanSession) =>
	session.blocks.reduce((total, block) => total + block.minutes, 0);

export const isHardSession = (session: PlanSession) => session.blocks.some((block) => block.hard);

export interface FreeTextUse {
	date: string;
	block: string;
	text: string;
}

const routineKinds: ReadonlySet<BlockKind> = new Set(['warmup', 'cooldown']);

export const freeTextInWorkBlocks = (sessions: PlanSession[]): FreeTextUse[] =>
	sessions.flatMap((session) =>
		session.blocks
			.filter((block) => !routineKinds.has(block.kind))
			.flatMap((block) =>
				block.prescriptions.flatMap((p) =>
					p.kind === 'freeText' ? [{ date: session.date, block: block.name, text: p.text }] : []
				)
			)
	);
