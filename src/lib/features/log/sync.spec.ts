import 'fake-indexeddb/auto';
import { v7 } from 'uuid';
import { describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '#lib/domain/log.ts';
import { openLogStore } from './store.ts';
import { syncOutbox, syncRoundLimit, type Transport } from './sync.ts';

const entry = (setIndex: number): LogEntry => ({
	id: v7({ msecs: Date.UTC(2026, 11, 7, 17) + setIndex, seq: 0 }),
	sessionDate: '2026-12-07',
	blockIndex: 1,
	prescriptionIndex: 0,
	setIndex,
	movement: 'back_squat',
	reps: 5,
	loggedAt: new Date(Date.UTC(2026, 11, 7, 17) + setIndex).toISOString(),
	deviceId: 'phone-1'
});

describe('syncOutbox', () => {
	it('stops after a bounded number of rounds and does not claim success while records are pending', async () => {
		const store = await openLogStore('sync-spec-unfinished');
		await store.save(entry(0));
		let logged = 0;
		const send = vi.fn<Transport>(async ({ records }) => {
			await store.save(entry(++logged));
			return Response.json({ accepted: records.map((record) => record.id) });
		});
		expect(await syncOutbox(store, send, 1)).toEqual({ kind: 'unfinished', count: syncRoundLimit(1, 1) });
		expect(send).toHaveBeenCalledTimes(syncRoundLimit(1, 1));
		expect(await store.pendingCount()).toBe(1);
		store.close();
	});

	it('allows one round per batch plus a little slack', () => {
		expect([syncRoundLimit(0, 100), syncRoundLimit(250, 100), syncRoundLimit(300, 100)]).toEqual([2, 5, 5]);
	});
});
