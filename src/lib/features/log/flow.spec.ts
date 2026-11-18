import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import week from '../../../../fixtures/plan/week-01.json' with { type: 'json' };
import { PlanWeek } from '#lib/domain/plan.ts';
import { LogFlow } from './flow.svelte.ts';
import type { Rest } from './rest.ts';
import { logSteps } from './steps.ts';
import { openLogStore, type LogStore } from './store.ts';

const [monday] = PlanWeek.parse(week);
const steps = logSteps(monday!);
const t0 = Date.parse('2026-12-07T09:00:00Z');
let dbCount = 0;

function harness() {
	const store = openLogStore(`flow-${dbCount++}`);
	let rest: Rest | undefined;
	let now = t0;
	let syncRequests = 0;
	const flow = () =>
		new LogFlow(monday!.date, steps, {
			store: () => store,
			deviceId: () => 'device-1',
			recallRest: () => rest,
			keepRest: (next) => (rest = next),
			saved: () => syncRequests++,
			now: () => new Date(now)
		});
	return {
		store: store as Promise<LogStore>,
		flow,
		rest: () => rest,
		tick: (ms: number) => (now += ms),
		syncRequests: () => syncRequests
	};
}

describe('LogFlow', () => {
	it('defaults reps to the prescribed minimum and never goes below zero', async () => {
		const flow = harness().flow();
		await flow.resume();
		expect(flow.reps).toBe(5);
		for (let i = 0; i < 7; i++) flow.less();
		expect(flow.reps).toBe(0);
		flow.more();
		expect(flow.reps).toBe(1);
	});

	it('Done writes the set locally first, starts a wall-clock rest and asks for a sync', async () => {
		const h = harness();
		const flow = h.flow();
		await flow.resume();
		flow.more();
		flow.rpe = 7.5;
		flow.note = '  felt fast  ';
		await flow.done();

		const [saved] = await (await h.store).pending(10);
		expect(saved).toMatchObject({
			sessionDate: '2026-12-07',
			blockIndex: 1,
			prescriptionIndex: 0,
			setIndex: 0,
			movement: 'back_squat',
			load: 170,
			reps: 6,
			rpe: 7.5,
			note: 'felt fast',
			loggedAt: '2026-12-07T09:00:00.000Z',
			deviceId: 'device-1'
		});
		expect(flow.saved?.id).toBe(saved?.id);
		expect(flow.restEndsAt).toBe(t0 + 90_000);
		expect(h.rest()).toEqual({ sessionDate: '2026-12-07', entryId: saved?.id, endsAt: t0 + 90_000 });
		expect(h.syncRequests()).toBe(1);
	});

	it('Undo is a tombstone that stays in the outbox, and the set can be logged again', async () => {
		const h = harness();
		const flow = h.flow();
		await flow.resume();
		await flow.done();
		const id = flow.saved?.id;
		h.tick(5_000);
		await flow.undo();

		const store = await h.store;
		expect(await store.entries()).toEqual([]);
		expect(await store.pending(10)).toEqual([expect.objectContaining({ id, deletedAt: '2026-12-07T09:00:05.000Z', revision: 2 })]);
		expect(flow.saved).toBeUndefined();
		expect(flow.index).toBe(0);
		expect(h.rest()).toBeUndefined();

		await flow.done();
		expect((await store.entries()).map((r) => r.setIndex)).toEqual([0]);
	});

	it('Next moves on to the following set with its own default reps', async () => {
		const flow = harness().flow();
		await flow.resume();
		flow.less();
		await flow.done();
		expect(flow.next).toBe('200 × 5');
		flow.advance();
		expect(flow.index).toBe(1);
		expect(flow.saved).toBeUndefined();
		expect(flow.reps).toBe(5);
	});

	it('a reload resumes at the first unlogged set, or on the resting set while its rest is remembered', async () => {
		const h = harness();
		const first = h.flow();
		await first.resume();
		for (let i = 0; i < 3; i++) {
			await first.done();
			if (i < 2) first.advance();
		}

		const resting = h.flow();
		await resting.resume();
		expect(resting.index).toBe(2);
		expect(resting.saved?.id).toBe(first.saved?.id);
		expect(resting.restEndsAt).toBe(first.restEndsAt);

		resting.advance();
		const reopened = h.flow();
		await reopened.resume();
		expect(reopened.index).toBe(3);
		expect(reopened.saved).toBeUndefined();
		expect(reopened.ready).toBe(true);
	});
});
