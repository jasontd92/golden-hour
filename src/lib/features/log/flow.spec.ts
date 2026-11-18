import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import week from '../../../../plan/week-08.json' with { type: 'json' };
import { PlanSession, PlanWeek } from '#lib/domain/plan.ts';
import { LogFlow } from './flow.svelte.ts';
import type { Rest } from './rest.ts';
import { openLogStore, type LogStore } from './store.ts';

const [monday] = PlanWeek.parse(week);
const t0 = Date.parse('2027-01-25T09:00:00Z');
let dbCount = 0;

const easyRun = PlanSession.parse({
	date: '2026-12-08',
	week: 1,
	title: 'Easy run',
	why: 'Aerobic base.',
	location: 'home',
	blocks: [{ name: 'Run', kind: 'conditioning', minutes: 40, hard: false, prescriptions: [{ kind: 'steady', movement: 'run', minutes: 40 }] }]
});

const pullUpsThenFran = PlanSession.parse({
	date: '2026-12-09',
	week: 1,
	title: 'Pull-ups + Fran',
	why: 'Benchmark.',
	location: 'rec',
	blocks: [
		{ name: 'Strength', kind: 'strength', minutes: 10, hard: false, prescriptions: [{ kind: 'fixedSets', movement: 'pull_up', sets: 2, reps: 5 }] },
		{
			name: 'Fran',
			kind: 'metcon',
			minutes: 10,
			hard: true,
			prescriptions: [{ kind: 'forTime', rounds: 3, movements: [{ movement: 'thruster', reps: 21, load: 95 }] }]
		}
	]
});

function harness(session: PlanSession = monday!) {
	const store = openLogStore(`flow-${dbCount++}`);
	let rest: Rest | undefined;
	let now = t0;
	let syncRequests = 0;
	const flow = () =>
		new LogFlow(session, {
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
			sessionDate: '2027-01-25',
			blockIndex: 1,
			prescriptionIndex: 0,
			setIndex: 0,
			movement: 'back_squat',
			load: 155,
			reps: 6,
			rpe: 7.5,
			note: 'felt fast',
			loggedAt: '2027-01-25T09:00:00.000Z',
			deviceId: 'device-1'
		});
		expect(flow.saved?.id).toBe(saved?.id);
		expect(flow.restEndsAt).toBe(t0 + 90_000);
		expect(h.rest()).toEqual({ sessionDate: '2027-01-25', entryId: saved?.id, endsAt: t0 + 90_000 });
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
		expect(await store.pending(10)).toEqual([expect.objectContaining({ id, deletedAt: '2027-01-25T09:00:05.000Z', revision: 2 })]);
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
		expect(flow.next).toBe('175 × 5');
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

	it('a session with no sets opens straight on the Session step and saves a session record', async () => {
		const h = harness(easyRun);
		const flow = h.flow();
		await flow.resume();
		expect(flow.onSession).toBe(true);
		expect(flow.scored).toBeUndefined();
		expect(flow.sessionRpe).toBe(4);
		for (let i = 0; i < 5; i++) flow.easier();
		expect(flow.sessionRpe).toBe(1);
		for (let i = 0; i < 12; i++) flow.harder();
		expect(flow.sessionRpe).toBe(10);
		flow.easier();
		flow.note = ' legs heavy ';
		await flow.done();

		const store = await h.store;
		expect(await store.entries()).toEqual([]);
		expect(await store.sessions()).toEqual([
			{
				kind: 'session',
				id: flow.savedSession?.id,
				sessionDate: '2026-12-08',
				rpe: 9,
				note: 'legs heavy',
				loggedAt: new Date(t0).toISOString(),
				deviceId: 'device-1',
				revision: 1
			}
		]);
		expect(h.syncRequests()).toBe(1);

		const reopened = h.flow();
		await reopened.resume();
		expect(reopened.savedSession?.id).toBe(flow.savedSession?.id);
		await reopened.undo();
		expect(await store.sessions()).toEqual([]);
		expect(reopened.savedSession).toBeUndefined();
		expect(reopened.onSession).toBe(true);
	});

	it('after the last set comes the Session step, scored when the session has a for-time block', async () => {
		const h = harness(pullUpsThenFran);
		const flow = h.flow();
		await flow.resume();
		await flow.done();
		flow.advance();
		await flow.done();
		expect(flow.next).toBe('Session');
		flow.advance();
		expect(flow.onSession).toBe(true);
		expect(flow.step).toBeUndefined();
		expect(flow.sessionRpe).toBe(7);
		expect(h.rest()).toBeUndefined();
		expect(flow.scored).toEqual({ blockIndex: 1, prescriptionIndex: 0, type: 'time' });

		flow.score = '4:75';
		expect(flow.scoreInvalid).toBe(true);
		await flow.done();
		expect(flow.savedSession).toBeUndefined();

		flow.score = '4:05';
		expect(flow.scoreInvalid).toBe(false);
		await flow.done();
		const [saved] = await (await h.store).sessions();
		expect(saved).toMatchObject({ rpe: 7, score: { blockIndex: 1, prescriptionIndex: 0, type: 'time', value: 245 } });

		const reopened = h.flow();
		await reopened.resume();
		expect(reopened.onSession).toBe(true);
		expect(reopened.score).toBe('4:05');
	});

	it('a reload after the last set, once rest is over, lands on the Session step', async () => {
		const h = harness(pullUpsThenFran);
		const flow = h.flow();
		await flow.resume();
		await flow.done();
		flow.advance();
		await flow.done();

		const resting = h.flow();
		await resting.resume();
		expect(resting.index).toBe(1);
		expect(resting.saved).toBeDefined();

		resting.advance();
		const reopened = h.flow();
		await reopened.resume();
		expect(reopened.onSession).toBe(true);
		expect(reopened.savedSession).toBeUndefined();
	});
});
