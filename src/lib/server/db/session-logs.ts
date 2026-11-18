import { getTableColumns, sql } from 'drizzle-orm';
import { SessionRecord } from '#lib/domain/log.ts';
import type { Db } from './client.ts';
import { sessionLogs, type SessionLogRow } from './schema.ts';

const { id, ...updatable } = getTableColumns(sessionLogs);
const fromIncoming = Object.fromEntries(
	Object.entries(updatable).map(([key, column]) => [key, sql.raw(`excluded.${column.name}`)])
);

export function toSessionRow({ kind, score, ...record }: SessionRecord, receivedAt: string): SessionLogRow {
	return {
		...record,
		scoreBlockIndex: score?.blockIndex ?? null,
		scorePrescriptionIndex: score?.prescriptionIndex ?? null,
		scoreType: score?.type ?? null,
		scoreValue: score?.value ?? null,
		note: record.note ?? null,
		deletedAt: record.deletedAt ?? null,
		receivedAt
	};
}

export function toSessionRecord(row: SessionLogRow): SessionRecord {
	const { receivedAt, scoreBlockIndex, scorePrescriptionIndex, scoreType, scoreValue, note, deletedAt, ...required } = row;
	const score = scoreType === null ? {} : { score: { blockIndex: scoreBlockIndex, prescriptionIndex: scorePrescriptionIndex, type: scoreType, value: scoreValue } };
	return SessionRecord.parse({
		kind: 'session',
		...required,
		...score,
		...(note === null ? {} : { note }),
		...(deletedAt === null ? {} : { deletedAt })
	});
}

export async function upsertSessionRecords(db: Db, records: SessionRecord[], receivedAt: string): Promise<void> {
	if (records.length === 0) return;
	await db
		.insert(sessionLogs)
		.values(records.map((record) => toSessionRow(record, receivedAt)))
		.onConflictDoUpdate({
			target: sessionLogs.id,
			set: fromIncoming,
			setWhere: sql`excluded.revision > ${sessionLogs.revision}`
		});
}

export async function allSessionRecords(db: Db): Promise<SessionRecord[]> {
	return (await db.select().from(sessionLogs)).map(toSessionRecord);
}

export async function sessionLogsReadable(db: Db): Promise<boolean> {
	try {
		await db.select({ id: sessionLogs.id }).from(sessionLogs).limit(1);
		return true;
	} catch {
		return false;
	}
}
