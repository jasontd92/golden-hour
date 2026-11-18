import { z } from 'zod';
import { MovementId } from './movements.ts';

export const ScoreType = z.enum(['time', 'load_lb', 'rounds_reps', 'reps', 'seconds', 'points', 'text', 'checkbox']);
export type ScoreType = z.infer<typeof ScoreType>;

export const ScoreUnit = z.enum(['s', 'lb', 'rounds.reps', 'rounds', 'reps', 'pts']);
export type ScoreUnit = z.infer<typeof ScoreUnit>;

export const WorkoutKind = z.enum([
	'girl',
	'hero',
	'notable',
	'competition',
	'test',
	'personal',
	'class_wod',
	'strength'
]);
export type WorkoutKind = z.infer<typeof WorkoutKind>;

export const WorkoutFormat = z.enum([
	'for_time',
	'amrap',
	'emom',
	'intervals',
	'max_load',
	'max_reps',
	'max_hold',
	'composite',
	'other'
]);
export type WorkoutFormat = z.infer<typeof WorkoutFormat>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const isoDay = z.iso.date();
const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const Workout = z.strictObject({
	id: slug,
	name: z.string().min(1),
	aliases: z.array(z.string().min(1)).optional(),
	kind: WorkoutKind,
	description: z.string().nullable().optional(),
	descriptions: z.array(z.string()).optional(),
	format: WorkoutFormat.optional(),
	time_cap_s: z.int().positive().optional(),
	score: z.strictObject({
		type: ScoreType,
		better: z.enum(['lower', 'higher']).nullable(),
		note: z.string().optional()
	}),
	equipment: z.array(z.string()).optional(),
	home_ok: z.boolean().optional(),
	home_note: z.string().optional(),
	favorite: z.boolean().optional(),
	recurrence: z.string().optional(),
	reference: z.string().optional(),
	definition_status: z.string().optional(),
	energy_tags_sheet: z.array(z.string()).optional(),
	sources: z.array(z.string()),
	tags: z.strictObject({
		movements: z.array(MovementId),
		patterns: z.array(z.string()),
		modality: z.string().regex(/^M?G?W?$/),
		home_ok_auto: z.boolean().nullable(),
		tag_source: z.enum(['auto', 'hand'])
	})
});
export type Workout = z.infer<typeof Workout>;

export const SugarWodSet = z.union([
	z.strictObject({ load: z.number(), success: z.boolean() }),
	z.strictObject({ mins: z.int().optional(), secs: z.number() }),
	z.strictObject({ rnds: z.int(), reps: z.int().optional() }),
	z.strictObject({ reps: z.int() }),
	z.strictObject({ other: z.string() }),
	z.strictObject({ boolean: z.union([z.literal(0), z.literal(1)]) })
]);
export type SugarWodSet = z.infer<typeof SugarWodSet>;

export const DatePrecision = z.enum(['day', 'approx', 'month', 'unknown']);
export type DatePrecision = z.infer<typeof DatePrecision>;

const datedAs: Record<DatePrecision, (date: string | undefined) => boolean> = {
	day: (date) => isoDay.safeParse(date).success,
	approx: (date) => isoDay.safeParse(date).success,
	month: (date) => isoMonth.safeParse(date).success,
	unknown: (date) => date === undefined
};

export const Result = z
	.strictObject({
		workout: slug,
		date: z.union([isoDay, isoMonth]).optional(),
		date_precision: DatePrecision,
		date_text: z.string().optional(),
		score_display: z.string().optional(),
		value: z.number().optional(),
		unit: ScoreUnit.optional(),
		rx: z.enum(['rx', 'scaled', 'scaled_up']).optional(),
		pr_flag: z.boolean().optional(),
		barbell_lift: slug.optional(),
		sets: z.array(SugarWodSet).optional(),
		detail: z.string().optional(),
		splits: z.record(z.string(), z.string()).optional(),
		location: z.string().optional(),
		test_round: z.string().optional(),
		notes: z.string().optional(),
		duplicate_of: z.string().optional(),
		conflict: z.string().optional(),
		source: z.string().min(1)
	})
	.refine((result) => datedAs[result.date_precision](result.date), {
		message: 'date must match date_precision: YYYY-MM-DD for day/approx, YYYY-MM for month, absent for unknown',
		path: ['date']
	})
	.refine((result) => result.date_precision !== 'unknown' || result.date_text !== undefined, {
		message: 'an unknown-precision date needs date_text',
		path: ['date_text']
	});
export type Result = z.infer<typeof Result>;

export const LiftEvidence = z.strictObject({
	date: isoDay.nullable(),
	load: z.number().positive(),
	reps: z.int().positive().nullable(),
	source: z.string().min(1),
	note: z.string().nullable().optional()
});
export type LiftEvidence = z.infer<typeof LiftEvidence>;

export const LiftsFile = z.record(slug, z.array(LiftEvidence));
export type LiftsFile = z.infer<typeof LiftsFile>;

export const WorkoutsFile = z.array(Workout);
export type WorkoutsFile = z.infer<typeof WorkoutsFile>;
