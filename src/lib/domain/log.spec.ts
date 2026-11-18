import { describe, expect, it } from 'vitest';
import { dayLog, LogEntry, LogRecord, SessionRecord, SyncRequest, syncBatchLimit } from './log.ts';

const entry = {
	id: '019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e5f',
	sessionDate: '2026-12-07',
	blockIndex: 1,
	prescriptionIndex: 0,
	setIndex: 2,
	movement: 'back_squat',
	load: 225,
	reps: 7,
	loggedAt: '2026-12-07T17:42:10.120-07:00',
	deviceId: 'phone-1'
};

describe('LogEntry', () => {
	it('accepts a logged set and keeps it as is', () => {
		expect(LogEntry.parse(entry)).toStrictEqual(entry);
		expect(LogEntry.parse({ ...entry, rpe: 8.5, note: 'grindy' })).toMatchObject({ rpe: 8.5 });
		const bodyweight = Object.fromEntries(Object.entries({ ...entry, movement: 'pull_up' }).filter(([key]) => key !== 'load'));
		expect(LogEntry.safeParse(bodyweight).success).toBe(true);
	});

	it('requires a client-generated uuid v7 id', () => {
		expect(LogEntry.safeParse({ ...entry, id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }).success).toBe(false);
		expect(LogEntry.safeParse({ ...entry, id: 'set-1' }).success).toBe(false);
	});

	it('requires loggedAt with an offset', () => {
		expect(LogEntry.safeParse({ ...entry, loggedAt: '2026-12-08T00:42:10Z' }).success).toBe(true);
		expect(LogEntry.safeParse({ ...entry, loggedAt: '2026-12-07 17:42' }).success).toBe(false);
	});

	it('rejects impossible sets', () => {
		expect(LogEntry.safeParse({ ...entry, reps: -1 }).success).toBe(false);
		expect(LogEntry.safeParse({ ...entry, load: 0 }).success).toBe(false);
		expect(LogEntry.safeParse({ ...entry, rpe: 11 }).success).toBe(false);
		expect(LogEntry.safeParse({ ...entry, rpe: 8.3 }).success).toBe(false);
		expect(LogEntry.safeParse({ ...entry, setIndex: 0.5 }).success).toBe(false);
	});
});

describe('LogRecord', () => {
	const record = { ...entry, revision: 1 };

	it('is a LogEntry plus a revision and an optional tombstone', () => {
		expect(LogRecord.parse(record)).toStrictEqual(record);
		expect(LogRecord.safeParse({ ...record, deletedAt: '2026-12-07T17:45:00.000-07:00' }).success).toBe(true);
		expect(LogRecord.safeParse(entry).success).toBe(false);
		expect(LogRecord.safeParse({ ...record, revision: 0 }).success).toBe(false);
		expect(LogRecord.safeParse({ ...record, synced: true }).success).toBe(false);
	});

	it('travels in bounded, non-empty batches', () => {
		expect(SyncRequest.safeParse({ records: [record] }).success).toBe(true);
		expect(SyncRequest.safeParse({ records: [] }).success).toBe(false);
		expect(SyncRequest.safeParse({ records: Array(syncBatchLimit + 1).fill(record) }).success).toBe(false);
	});
});

describe('SessionRecord', () => {
	const session = {
		kind: 'session',
		id: '019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e60',
		sessionDate: '2026-12-08',
		rpe: 9,
		score: { blockIndex: 2, prescriptionIndex: 0, type: 'time', value: 245 },
		loggedAt: '2026-12-08T07:10:00.000-07:00',
		deviceId: 'phone-1',
		revision: 1
	};

	it('is a done session with an integer RPE and an optional score', () => {
		expect(SessionRecord.parse(session)).toStrictEqual(session);
		const { score, ...unscored } = session;
		expect(SessionRecord.safeParse(unscored).success).toBe(true);
		expect(SessionRecord.safeParse({ ...session, rpe: 8.5 }).success).toBe(false);
		expect(SessionRecord.safeParse({ ...session, rpe: 0 }).success).toBe(false);
		expect(SessionRecord.safeParse({ ...session, score: { ...score, type: 'text' } }).success).toBe(false);
		expect(SessionRecord.safeParse({ ...session, kind: 'set' }).success).toBe(false);
	});

	it('travels in the same batches as sets, and a set never passes as a session', () => {
		const { kind, ...withoutKind } = session;
		expect(SyncRequest.safeParse({ records: [session] }).success).toBe(true);
		expect(SyncRequest.safeParse({ records: [withoutKind] }).success).toBe(false);
	});
});

describe('dayLog', () => {
	it("splits one day's records into sets in logged order and the latest session record", () => {
		const record = LogRecord.parse({ ...entry, revision: 1 });
		const later = { ...record, id: '019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e60', reps: 5, loggedAt: '2026-12-08T00:50:00Z' };
		const otherDay = { ...record, id: '019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e61', sessionDate: '2026-12-08' };
		const session = (id: string, rpe: number, loggedAt: string): SessionRecord => ({
			kind: 'session',
			id,
			sessionDate: '2026-12-07',
			rpe,
			loggedAt,
			deviceId: 'phone-1',
			revision: 1
		});
		const first = session('019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e62', 6, '2026-12-07T18:00:00-07:00');
		const second = session('019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e63', 8, '2026-12-08T02:00:00Z');
		expect(dayLog([later, second, otherDay, first, record], '2026-12-07')).toEqual({ sets: [record, later], session: second });
		expect(dayLog([otherDay], '2026-12-07')).toEqual({ sets: [], session: undefined });
	});
});
