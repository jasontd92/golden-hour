import { z } from 'zod';
import { ScoreType } from './history.ts';
import { MovementId } from './movements.ts';

const index = z.int().nonnegative();
const note = z.string().min(1).max(500);
const loggedAt = z.iso.datetime({ offset: true });
const deviceId = z.string().min(1).max(64);
const syncFields = { revision: z.int().positive(), deletedAt: z.iso.datetime({ offset: true }).optional() };

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
	note: note.optional(),
	loggedAt,
	deviceId
});
export type LogEntry = z.infer<typeof LogEntry>;

export const LogRecord = LogEntry.extend(syncFields);
export type LogRecord = z.infer<typeof LogRecord>;

export const SessionScoreType = ScoreType.exclude(['text', 'checkbox']);
export type SessionScoreType = z.infer<typeof SessionScoreType>;

export const SessionScore = z.strictObject({
	blockIndex: index,
	prescriptionIndex: index,
	type: SessionScoreType,
	value: z.number().nonnegative()
});
export type SessionScore = z.infer<typeof SessionScore>;

export const SessionLog = z.strictObject({
	kind: z.literal('session'),
	id: LogEntryId,
	sessionDate: z.iso.date(),
	rpe: z.int().min(1).max(10),
	score: SessionScore.optional(),
	note: note.optional(),
	loggedAt,
	deviceId
});
export type SessionLog = z.infer<typeof SessionLog>;

export const SessionRecord = SessionLog.extend(syncFields);
export type SessionRecord = z.infer<typeof SessionRecord>;

export const SyncRecord = z.union([LogRecord, SessionRecord]);
export type SyncRecord = z.infer<typeof SyncRecord>;

export const isSessionRecord = (record: SyncRecord): record is SessionRecord => 'kind' in record;
const isSetRecord = (record: SyncRecord): record is LogRecord => !isSessionRecord(record);

export type SessionsByDate = ReadonlyMap<string, SessionRecord>;

const byLoggedAt = (a: SyncRecord, b: SyncRecord) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt);
const preferred = (a: SessionRecord, b: SessionRecord) => Number(!a.deletedAt) - Number(!b.deletedAt) || byLoggedAt(a, b);

export function sessionsByDate(records: readonly SyncRecord[]): SessionsByDate {
	const byDate = new Map<string, SessionRecord>();
	for (const record of records.filter(isSessionRecord)) {
		const kept = byDate.get(record.sessionDate);
		if (!kept || preferred(record, kept) > 0) byDate.set(record.sessionDate, record);
	}
	return byDate;
}

export const replaceSession = (existing: SessionRecord | undefined, next: SessionLog): SessionRecord =>
	SessionRecord.parse({ ...next, ...(existing ? { id: existing.id, revision: existing.revision + 1 } : { revision: 1 }) });

export interface DayLog {
	sets: LogRecord[];
	session: SessionRecord | undefined;
}

export function dayLog(records: readonly SyncRecord[], date: string): DayLog {
	const session = sessionsByDate(records).get(date);
	return {
		sets: records.filter((r): r is LogRecord => isSetRecord(r) && r.sessionDate === date).toSorted(byLoggedAt),
		session: session?.deletedAt ? undefined : session
	};
}

export const syncBatchLimit = 100;

export const SyncRequest = z.strictObject({ records: z.array(SyncRecord).min(1).max(syncBatchLimit) });
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncResponse = z.strictObject({ accepted: z.array(LogEntryId) });
export type SyncResponse = z.infer<typeof SyncResponse>;
