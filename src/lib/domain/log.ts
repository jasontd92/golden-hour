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

export const LogRecord = LogEntry.extend({
	revision: z.int().positive(),
	deletedAt: z.iso.datetime({ offset: true }).optional()
});
export type LogRecord = z.infer<typeof LogRecord>;

export const syncBatchLimit = 100;

export const SyncRequest = z.strictObject({ records: z.array(LogRecord).min(1).max(syncBatchLimit) });
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncResponse = z.strictObject({ accepted: z.array(LogEntryId) });
export type SyncResponse = z.infer<typeof SyncResponse>;
