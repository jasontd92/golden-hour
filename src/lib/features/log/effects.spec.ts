import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '#lib/domain/log.ts';
import { retryDelayMs, startSyncLoop } from './effects.ts';
import { openLogStore } from './store.ts';
import type { SyncOutcome, Transport } from './sync.ts';

const entry: LogEntry = {
	id: '019a8f3e-7c2b-7d41-9a6e-3f2b1c0d4e5f',
	sessionDate: '2026-12-07',
	blockIndex: 1,
	prescriptionIndex: 0,
	setIndex: 0,
	movement: 'back_squat',
	reps: 5,
	loggedAt: '2026-12-07T17:42:10.120-07:00',
	deviceId: 'phone-1'
};

afterEach(() => {
	vi.useRealTimers();
});

describe('retryDelayMs', () => {
	it('doubles from one second up to a minute', () => {
		expect([0, 1, 2, 10].map(retryDelayMs)).toEqual([1_000, 2_000, 4_000, 60_000]);
	});
});

describe('startSyncLoop', () => {
	it('syncs on open, retries with backoff while offline, and syncs on the online event', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const store = await openLogStore('effects-spec');
		await store.save(entry);
		let online = false;
		const send = vi.fn<Transport>(async ({ records }) => {
			if (!online) throw new TypeError('Failed to fetch');
			return Response.json({ accepted: records.map((record) => record.id) });
		});
		const outcomes: SyncOutcome[] = [];
		const target = new EventTarget();
		const loop = startSyncLoop(store, () => send, (outcome) => outcomes.push(outcome), target);
		await vi.waitFor(() => expect(outcomes).toEqual([{ kind: 'offline' }]));
		await vi.advanceTimersByTimeAsync(1_000);
		await vi.waitFor(() => expect(outcomes).toHaveLength(2));
		online = true;
		target.dispatchEvent(new Event('online'));
		await vi.waitFor(() => expect(outcomes.at(-1)).toEqual({ kind: 'synced', count: 1 }));
		expect(await store.pendingCount()).toBe(0);
		loop.stop();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('stops retrying on a wrong token and waits without one', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const store = await openLogStore('effects-spec-401');
		await store.save(entry);
		const outcomes: SyncOutcome[] = [];
		const target = new EventTarget();
		startSyncLoop(store, () => async () => new Response(null, { status: 401 }), (o) => outcomes.push(o), target);
		await vi.waitFor(() => expect(outcomes).toEqual([{ kind: 'unauthorized' }]));
		expect(vi.getTimerCount()).toBe(0);
		const idle = vi.fn();
		startSyncLoop(store, () => undefined, idle, target).stop();
		expect(idle).not.toHaveBeenCalled();
	});
});
