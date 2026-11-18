import { getTableColumns, sql } from 'drizzle-orm';
import { LogRecord } from '#lib/domain/log.ts';
import type { Db } from './client.ts';
import { logEntries, type LogEntryRow } from './schema.ts';

const { id, ...updatable } = getTableColumns(logEntries);
const fromIncoming = Object.fromEntries(
	Object.entries(updatable).map(([key, column]) => [key, sql.raw(`excluded.${column.name}`)])
);

export function toRow(record: LogRecord, receivedAt: string): LogEntryRow {
	return {
		...record,
		load: record.load ?? null,
		rpe: record.rpe ?? null,
		note: record.note ?? null,
		deletedAt: record.deletedAt ?? null,
		receivedAt
	};
}

export function toRecord(row: LogEntryRow): LogRecord {
	const { receivedAt, load, rpe, note, deletedAt, ...required } = row;
	return LogRecord.parse({
		...required,
		...(load === null ? {} : { load }),
		...(rpe === null ? {} : { rpe }),
		...(note === null ? {} : { note }),
		...(deletedAt === null ? {} : { deletedAt })
	});
}

export async function upsertLogRecords(db: Db, records: LogRecord[], receivedAt: string): Promise<void> {
	await db
		.insert(logEntries)
		.values(records.map((record) => toRow(record, receivedAt)))
		.onConflictDoUpdate({
			target: logEntries.id,
			set: fromIncoming,
			setWhere: sql`excluded.revision > ${logEntries.revision}`
		});
}

export async function allLogRecords(db: Db): Promise<LogRecord[]> {
	return (await db.select().from(logEntries)).map(toRecord);
}

export async function logEntriesReadable(db: Db): Promise<boolean> {
	try {
		await db.select({ id: logEntries.id }).from(logEntries).limit(1);
		return true;
	} catch {
		return false;
	}
}
