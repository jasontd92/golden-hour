import { z } from 'zod';
import { MovementId } from './movements.ts';

const index = z.int().nonnegative();

export const LogEntryId = z.uuid({ version: 'v7' });
export type LogEntryId = z.infer<typeof LogEntryId>;

export const LogEntry = z.strictObject({
	id: LogEntryId,
	sessionDate: z.iso.date(),
	blockIndex: index,
	prescriptionIndex: index,
	setIndex: index,
	movement: MovementId,
	load: z.number().positive().optional(),
	reps: z.int().nonnegative(),
	rpe: z.number().min(1).max(10).multipleOf(0.5).optional(),
	note: z.string().min(1).max(500).optional(),
	loggedAt: z.iso.datetime({ offset: true }),
	deviceId: z.string().min(1).max(64)
});
export type LogEntry = z.infer<typeof LogEntry>;
