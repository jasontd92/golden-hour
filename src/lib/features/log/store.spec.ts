import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '#lib/domain/log.ts';
import { openLogStore } from './store.ts';

const entry: LogEntry = {
	id: '019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e5f',
	sessionDate: '2026-12-07',
	blockIndex: 1,
	prescriptionIndex: 0,
	setIndex: 0,
	movement: 'back_squat',
	load: 225,
	reps: 5,
	loggedAt: '2026-12-07T17:42:10.120-07:00',
	deviceId: 'phone-1'
};

let n = 0;
const fresh = () => openLogStore(`store-spec-${n++}`);

describe('openLogStore', () => {
	it('keeps entries pending until the server acknowledges the revision that was sent', async () => {
		const store = await fresh();
		const saved = await store.save(entry);
		expect(saved).toEqual({ ...entry, revision: 1 });
		await store.amend(entry.id, { rpe: 8 });
		expect(await store.acknowledge([saved], [entry.id])).toBe(0);
		const [latest] = await store.pending(10);
		expect(latest).toEqual({ ...entry, rpe: 8, revision: 2 });
		expect(await store.acknowledge([latest!], [])).toBe(0);
		expect(await store.acknowledge([latest!], [entry.id])).toBe(1);
		expect(await store.pendingCount()).toBe(0);
	});

	it('undo writes a pending tombstone instead of deleting', async () => {
		const store = await fresh();
		await store.save(entry);
		await store.undo(entry.id, new Date('2026-12-08T00:45:00.000Z'));
		expect(await store.entries()).toEqual([]);
		expect(await store.pending(10)).toEqual([{ ...entry, revision: 2, deletedAt: '2026-12-08T00:45:00.000Z' }]);
		await expect(store.undo(entry.id)).rejects.toThrow(/undone/);
	});

	it('refuses invalid, duplicate and unknown entries', async () => {
		const store = await fresh();
		await expect(store.save({ ...entry, reps: -1 })).rejects.toThrow();
		await store.save(entry);
		await expect(store.save(entry)).rejects.toThrow();
		await expect(store.amend('019a8f3e-7c2b-7d41-9a6e-000000000000', { note: 'x' })).rejects.toThrow(/No log entry/);
		expect(await store.entries()).toHaveLength(1);
	});
});
