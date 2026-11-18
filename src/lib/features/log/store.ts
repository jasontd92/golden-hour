import { openDB, type DBSchema } from 'idb';
import { isSessionRecord, LogEntry, LogRecord, SessionLog, SessionRecord, SyncRecord } from '#lib/domain/log.ts';

interface StoredRecord {
	id: string;
	record: SyncRecord;
	pending: 0 | 1;
}

interface LogDb extends DBSchema {
	records: { key: string; value: StoredRecord; indexes: { pending: number } };
}

export type Amendment = Partial<Pick<LogEntry, 'rpe' | 'note'>>;

const isLive = (record: SyncRecord) => !record.deletedAt;

export interface LogStore {
	save(entry: LogEntry): Promise<LogRecord>;
	saveSession(session: SessionLog): Promise<SessionRecord>;
	undo(id: string, at?: Date): Promise<void>;
	amend(id: string, amendment: Amendment): Promise<void>;
	entries(): Promise<LogRecord[]>;
	sessions(): Promise<SessionRecord[]>;
	pending(limit: number): Promise<SyncRecord[]>;
	pendingCount(): Promise<number>;
	acknowledge(sent: SyncRecord[], accepted: string[]): Promise<number>;
	stillPending(sent: SyncRecord[]): Promise<number>;
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

	async function add<R extends SyncRecord>(record: R): Promise<R> {
		const tx = db.transaction('records', 'readwrite');
		await Promise.all([tx.store.add({ id: record.id, record, pending: 1 }), tx.done]);
		return record;
	}

	const all = async () => (await db.getAll('records')).map((stored) => stored.record);

	async function revise(id: string, change: (record: SyncRecord) => SyncRecord): Promise<void> {
		const tx = db.transaction('records', 'readwrite');
		const stored = await tx.store.get(id);
		if (!stored) throw new Error(`No log entry ${id} to change.`);
		if (stored.record.deletedAt) throw new Error(`Log entry ${id} was undone.`);
		const record = SyncRecord.parse(withoutUndefined({ ...change(stored.record), revision: stored.record.revision + 1 }));
		await Promise.all([tx.store.put({ id, record, pending: 1 }), tx.done]);
	}

	return {
		save: async (entry) => add(LogRecord.parse(withoutUndefined({ ...LogEntry.parse(entry), revision: 1 }))),
		saveSession: async (session) => add(SessionRecord.parse(withoutUndefined({ ...SessionLog.parse(session), revision: 1 }))),
		undo: (id, at = new Date()) => revise(id, (record) => ({ ...record, deletedAt: at.toISOString() })),
		amend: (id, amendment) => revise(id, (record) => ({ ...record, ...amendment })),
		entries: async () => (await all()).filter((record): record is LogRecord => isLive(record) && !isSessionRecord(record)),
		sessions: async () => (await all()).filter((record): record is SessionRecord => isLive(record) && isSessionRecord(record)),
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
		async stillPending(sent) {
			const tx = db.transaction('records', 'readonly');
			const stored = await Promise.all(sent.map((record) => tx.store.get(record.id)));
			await tx.done;
			return stored.filter((s, i) => s?.pending && s.record.revision === sent[i]!.revision).length;
		},
		close: () => db.close()
	};
}
