import { openDB, type DBSchema } from 'idb';
import { LogEntry, LogRecord } from '#lib/domain/log.ts';

interface StoredRecord {
	id: string;
	record: LogRecord;
	pending: 0 | 1;
}

interface LogDb extends DBSchema {
	records: { key: string; value: StoredRecord; indexes: { pending: number } };
}

export type Amendment = Partial<Pick<LogEntry, 'rpe' | 'note'>>;

export interface LogStore {
	save(entry: LogEntry): Promise<LogRecord>;
	undo(id: string, at?: Date): Promise<void>;
	amend(id: string, amendment: Amendment): Promise<void>;
	entries(): Promise<LogRecord[]>;
	pending(limit: number): Promise<LogRecord[]>;
	pendingCount(): Promise<number>;
	acknowledge(sent: LogRecord[], accepted: string[]): Promise<number>;
	close(): void;
}

const withoutUndefined = <T extends object>(value: T): T =>
	Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

export async function openLogStore(name = 'golden-hour-log'): Promise<LogStore> {
	const db = await openDB<LogDb>(name, 1, {
		upgrade(db) {
			db.createObjectStore('records', { keyPath: 'id' }).createIndex('pending', 'pending');
		}
	});

	async function revise(id: string, change: (record: LogRecord) => LogRecord): Promise<void> {
		const tx = db.transaction('records', 'readwrite');
		const stored = await tx.store.get(id);
		if (!stored) throw new Error(`No log entry ${id} to change.`);
		if (stored.record.deletedAt) throw new Error(`Log entry ${id} was undone.`);
		const record = LogRecord.parse(withoutUndefined({ ...change(stored.record), revision: stored.record.revision + 1 }));
		await Promise.all([tx.store.put({ id, record, pending: 1 }), tx.done]);
	}

	return {
		async save(entry) {
			const record = LogRecord.parse(withoutUndefined({ ...LogEntry.parse(entry), revision: 1 }));
			const tx = db.transaction('records', 'readwrite');
			await Promise.all([tx.store.add({ id: record.id, record, pending: 1 }), tx.done]);
			return record;
		},
		undo: (id, at = new Date()) => revise(id, (record) => ({ ...record, deletedAt: at.toISOString() })),
		amend: (id, amendment) => revise(id, (record) => ({ ...record, ...amendment })),
		async entries() {
			const all = await db.getAll('records');
			return all.map((stored) => stored.record).filter((record) => !record.deletedAt);
		},
		async pending(limit) {
			return (await db.getAllFromIndex('records', 'pending', 1, limit)).map((stored) => stored.record);
		},
		pendingCount: () => db.countFromIndex('records', 'pending', 1),
		async acknowledge(sent, accepted) {
			const acceptedIds = new Set(accepted);
			const tx = db.transaction('records', 'readwrite');
			let marked = 0;
			for (const record of sent) {
				if (!acceptedIds.has(record.id)) continue;
				const stored = await tx.store.get(record.id);
				if (stored?.pending && stored.record.revision === record.revision) {
					await tx.store.put({ ...stored, pending: 0 });
					marked++;
				}
			}
			await tx.done;
			return marked;
		},
		close: () => db.close()
	};
}
