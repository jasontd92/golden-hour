import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { v7 } from 'uuid';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { isSessionRecord, type LogEntry, type SessionLog, type SyncRecord, type SyncRequest } from '#lib/domain/log.ts';
import { openLogStore, type LogStore } from '#lib/features/log/store.ts';
import { syncOutbox, type SyncOutcome, type Transport } from '#lib/features/log/sync.ts';
import type { Db } from '#lib/server/db/client.ts';
import { allLogRecords } from '#lib/server/db/log-entries.ts';
import { logEntries, sessionLogs } from '#lib/server/db/schema.ts';
import { allSessionRecords } from '#lib/server/db/session-logs.ts';
import { syncDatabase } from '#lib/server/sync-env.ts';
import { GET, POST } from './+server.ts';

vi.mock('$app/env/private', () => ({ SYNC_TOKEN: 'test-token', TURSO_DATABASE_URL: ':memory:', TURSO_AUTH_TOKEN: undefined }));

let db: Db;
beforeAll(async () => {
	expect((await (await GET({} as Parameters<typeof GET>[0])).json())).toEqual({ token: true, database: 'ready' });
	const database = await syncDatabase();
	if (database.status !== 'ready') throw new Error(`database is ${database.status}`);
	db = database.db;
});

const post = (body: string, token = 'test-token') =>
	POST({
		request: new Request('http://app.test/api/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body
		})
	} as Parameters<typeof POST>[0]) as Promise<Response>;

interface PartialServer {
	commit: boolean[];
	ack: boolean[];
}

const chosen = (mask: boolean[], index: number) => mask[index % mask.length]!;

class Network {
	online = true;
	loseNextResponse = false;
	partial: PartialServer | undefined;
	inFlight: (() => Promise<void>) | undefined;
	readonly sent: string[] = [];

	readonly transport: Transport = async (request: SyncRequest) => {
		if (!this.online) throw new TypeError('Failed to fetch');
		const partial = this.partial;
		const records = partial ? request.records.filter((_, i) => chosen(partial.commit, i)) : request.records;
		let response = Response.json({ accepted: [] });
		if (records.length > 0) {
			const body = JSON.stringify({ records });
			this.sent.push(body);
			response = await post(body);
		}
		if (partial && response.ok) {
			const { accepted } = (await response.json()) as { accepted: string[] };
			const position = new Map(request.records.map((record, i) => [record.id, i]));
			response = Response.json({ accepted: accepted.filter((id) => chosen(partial.ack, position.get(id)!)) });
		}
		const during = this.inFlight;
		this.inFlight = undefined;
		await during?.();
		if (this.loseNextResponse) {
			this.loseNextResponse = false;
			throw new TypeError('The network connection was lost.');
		}
		return response;
	};
}

const setFields = fc.record({
	movement: fc.constantFrom('back_squat', 'deadlift', 'pull_up'),
	reps: fc.integer({ min: 0, max: 20 }),
	load: fc.option(fc.integer({ min: 9, max: 80 }).map((plates) => plates * 5), { nil: undefined })
});
const sessionFields = fc.record({
	rpe: fc.integer({ min: 1, max: 10 }),
	score: fc.option(
		fc.record({
			blockIndex: fc.constant(2),
			prescriptionIndex: fc.constant(0),
			type: fc.constantFrom('time' as const, 'rounds_reps' as const),
			value: fc.integer({ min: 0, max: 3_600_000 }).map((n) => n / 1000)
		}).map((score) => ({ ...score })),
		{ nil: undefined }
	),
	note: fc.option(fc.constantFrom('legs heavy', 'paced it'), { nil: undefined })
});
const tab = fc.integer({ min: 0, max: 1 });
const mask = fc.array(fc.boolean(), { minLength: 1, maxLength: 4 });

const command = fc.oneof(
	{ weight: 4, arbitrary: fc.record({ kind: fc.constant('log' as const), tab, set: setFields }) },
	{ weight: 2, arbitrary: fc.record({ kind: fc.constant('logSession' as const), tab, session: sessionFields }) },
	{ weight: 2, arbitrary: fc.record({ kind: fc.constant('undo' as const), tab, pick: fc.nat() }) },
	{ weight: 1, arbitrary: fc.record({ kind: fc.constant('amend' as const), tab, pick: fc.nat(), rpe: fc.integer({ min: 2, max: 20 }).map((half) => half / 2) }) },
	{ weight: 1, arbitrary: fc.constant({ kind: 'offline' as const }) },
	{ weight: 1, arbitrary: fc.constant({ kind: 'online' as const }) },
	{ weight: 2, arbitrary: fc.record({ kind: fc.constant('sync' as const), tab }) },
	{ weight: 2, arbitrary: fc.record({ kind: fc.constant('interruptedSync' as const), tab }) },
	{ weight: 2, arbitrary: fc.record({ kind: fc.constant('partialSync' as const), tab, commit: mask, ack: mask }) },
	{ weight: 1, arbitrary: fc.record({ kind: fc.constant('undoDuringSync' as const), tab, pick: fc.nat() }) },
	{ weight: 2, arbitrary: fc.record({ kind: fc.constant('replaySync' as const), pick: fc.nat() }) },
	{ weight: 1, arbitrary: fc.record({ kind: fc.constant('reload' as const), tab }) },
	{ weight: 1, arbitrary: fc.record({ kind: fc.constant('reloadDuringSync' as const), tab }) },
	{ weight: 1, arbitrary: fc.constant({ kind: 'concurrentSync' as const }) }
);
type Command = typeof command extends fc.Arbitrary<infer C> ? C : never;

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
type Logged = LogEntry | SessionLog;
const content = ({ revision, deletedAt, ...entry }: SyncRecord): Logged => entry;
const performed = (record: SyncRecord) =>
	JSON.stringify(
		isSessionRecord(record)
			? [record.deviceId, record.loggedAt, record.sessionDate, record.kind]
			: [record.deviceId, record.loggedAt, record.sessionDate, record.blockIndex, record.prescriptionIndex, record.setIndex, record.movement]
	);
const withoutUndefined = <T extends object>(value: T): T =>
	Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

class PageReloaded extends Error {}

async function onThePhone(change: string, applied: Promise<void>) {
	try {
		await applied;
	} catch (error) {
		expect.fail(`[client] the phone can still ${change}: ${String(error)}`);
	}
}

let run = 0;

async function play(commands: Command[]) {
	await db.delete(logEntries);
	await db.delete(sessionLogs);
	const name = `property-${run++}`;
	const tabs: LogStore[] = [await openLogStore(name), await openLogStore(name)];
	const network = new Network();
	const live = new Map<string, Logged>();
	const undone = new Set<string>();
	const pickLive = (pick: number) => [...live.keys()][pick % live.size];
	const undo = async (store: LogStore, id: string) => {
		await onThePhone(`undo ${id}`, store.undo(id, new Date(Date.UTC(2026, 11, 7, 18))));
		live.delete(id);
		undone.add(id);
	};
	const reload = async (index: number) => {
		tabs[index]!.close();
		tabs[index] = await openLogStore(name);
	};
	const sync = (index: number) => syncOutbox(tabs[index]!, network.transport, 3);
	const expectHonest = async (outcomes: SyncOutcome[]) => {
		if (!outcomes.some((outcome) => outcome.kind === 'synced')) return;
		expect(await tabs[0]!.pendingCount(), `[outcome] a sync that reports success leaves nothing pending (${JSON.stringify(outcomes)})`).toBe(0);
	};
	const expectSucceeded = (outcomes: SyncOutcome[]) => {
		if (!network.online) return;
		expect(outcomes.map((outcome) => outcome.kind), '[outcome] an online sync whose records all reached the server reports success').toStrictEqual(outcomes.map(() => 'synced'));
	};
	const expectDrained = async (outcomes: SyncOutcome[]) => {
		await expectHonest(outcomes);
		if (!network.online) return;
		expect(await tabs[0]!.pendingCount(), `[drain] one clean online sync leaves nothing pending (${JSON.stringify(outcomes)})`).toBe(0);
		expectSucceeded(outcomes);
	};
	let clock = Date.UTC(2026, 11, 7, 17);

	for (const step of commands) {
		if (step.kind === 'log') {
			clock += 1000;
			const entry: LogEntry = {
				id: v7({ msecs: clock, seq: 0 }),
				sessionDate: '2026-12-07',
				blockIndex: 1,
				prescriptionIndex: 0,
				setIndex: live.size,
				...step.set,
				loggedAt: new Date(clock).toISOString(),
				deviceId: 'phone-1'
			};
			if (entry.load === undefined) delete entry.load;
			await tabs[step.tab]!.save(entry);
			live.set(entry.id, entry);
		} else if (step.kind === 'logSession') {
			clock += 1000;
			const session: SessionLog = withoutUndefined({
				kind: 'session',
				id: v7({ msecs: clock, seq: 0 }),
				sessionDate: '2026-12-07',
				...step.session,
				loggedAt: new Date(clock).toISOString(),
				deviceId: 'phone-1'
			});
			await tabs[step.tab]!.saveSession(session);
			live.set(session.id, session);
		} else if (step.kind === 'undo' && live.size > 0) {
			await undo(tabs[step.tab]!, pickLive(step.pick)!);
		} else if (step.kind === 'amend' && live.size > 0) {
			const id = pickLive(step.pick)!;
			const logged = live.get(id)!;
			const rpe = 'kind' in logged ? Math.ceil(step.rpe) : step.rpe;
			await onThePhone(`amend ${id}`, tabs[step.tab]!.amend(id, { rpe }));
			live.set(id, { ...logged, rpe });
		} else if (step.kind === 'offline') {
			network.online = false;
		} else if (step.kind === 'online') {
			network.online = true;
		} else if (step.kind === 'sync') {
			await expectDrained([await sync(step.tab)]);
		} else if (step.kind === 'interruptedSync') {
			network.loseNextResponse = true;
			await expectHonest([await sync(step.tab)]);
			network.loseNextResponse = false;
		} else if (step.kind === 'partialSync') {
			network.partial = step;
			await expectHonest([await sync(step.tab)]);
			network.partial = undefined;
		} else if (step.kind === 'undoDuringSync' && live.size > 0) {
			const id = pickLive(step.pick)!;
			network.inFlight = () => undo(tabs[step.pick % 2]!, id);
			const outcome = await sync(step.tab);
			await expectHonest([outcome]);
			expectSucceeded([outcome]);
			if (network.inFlight) await network.inFlight();
			network.inFlight = undefined;
		} else if (step.kind === 'replaySync' && network.sent.length > 0) {
			await post(network.sent[step.pick % network.sent.length]!);
		} else if (step.kind === 'reload') {
			await reload(step.tab);
		} else if (step.kind === 'reloadDuringSync') {
			const reloadPage = async () => {
				await reload(step.tab);
				throw new PageReloaded();
			};
			network.inFlight = reloadPage;
			await sync(step.tab);
			if (network.inFlight === reloadPage) await reload(step.tab);
			network.inFlight = undefined;
		} else if (step.kind === 'concurrentSync') {
			await expectDrained(await Promise.all([sync(0), sync(1)]));
		}
	}

	network.online = true;
	await expectDrained([await sync(0)]);

	const server: SyncRecord[] = [...(await allLogRecords(db)), ...(await allSessionRecords(db))];
	const client: SyncRecord[] = [...(await tabs[0]!.entries()), ...(await tabs[0]!.sessions())].sort(byId);
	for (const store of tabs) store.close();
	return {
		expected: [...live.values()].sort(byId),
		client,
		server,
		serverLive: server.filter((record) => !record.deletedAt).sort(byId),
		serverUndone: server.filter((record) => record.deletedAt).map((record) => record.id).sort(),
		undone: [...undone].sort()
	};
}

function expectConverged(result: Awaited<ReturnType<typeof play>>) {
	const copies = new Map<string, number>();
	for (const record of result.server) copies.set(performed(record), (copies.get(performed(record)) ?? 0) + 1);
	expect(result.client.map(content), '[client] the phone keeps exactly the non-undone entries').toStrictEqual(result.expected);
	expect([...copies.values()].filter((count) => count > 1), '[duplicate] each performed set and session is stored once on the server').toStrictEqual([]);
	expect(result.serverLive, '[server] the server holds the phone\'s entries, revision for revision').toStrictEqual(result.client);
	expect(result.serverUndone, '[tombstone] every undo reached the server and none was resurrected').toStrictEqual(result.undone);
}

describe('hold-the-line A: no log entry is ever lost', () => {
	it('the server ends with exactly the client\'s non-undone entries, whatever the network does', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(command, { maxLength: 40, size: 'max' }), async (commands) => expectConverged(await play(commands))),
			{ numRuns: 1000, includeErrorInReport: true }
		);
	}, 120_000);

	it('positive control: a scripted interrupted, partial, raced, replayed and reloaded history converges', async () => {
		const set = { movement: 'back_squat' as const, reps: 5, load: 225 };
		const run = { rpe: 6, score: undefined, note: undefined };
		const fran = { rpe: 9, score: { blockIndex: 2 as const, prescriptionIndex: 0 as const, type: 'time' as const, value: 245 }, note: 'paced it' as const };
		const result = await play([
			{ kind: 'log', tab: 0, set },
			{ kind: 'logSession', tab: 1, session: run },
			{ kind: 'interruptedSync', tab: 0 },
			{ kind: 'log', tab: 1, set },
			{ kind: 'log', tab: 0, set },
			{ kind: 'partialSync', tab: 1, commit: [true, false], ack: [false, true] },
			{ kind: 'undoDuringSync', tab: 0, pick: 0 },
			{ kind: 'replaySync', pick: 0 },
			{ kind: 'reloadDuringSync', tab: 0 },
			{ kind: 'offline' },
			{ kind: 'log', tab: 1, set },
			{ kind: 'reload', tab: 1 },
			{ kind: 'amend', tab: 0, pick: 1, rpe: 8 },
			{ kind: 'logSession', tab: 0, session: fran },
			{ kind: 'online' },
			{ kind: 'concurrentSync' }
		]);
		expect(result.expected.filter((logged) => 'kind' in logged)).toHaveLength(2);
		expect(result.expected).toHaveLength(5);
		expect(result.undone).toHaveLength(1);
		expectConverged(result);
	});

	it('one clean sync drains an outbox larger than the batch limit', async () => {
		await db.delete(logEntries);
		await db.delete(sessionLogs);
		const store = await openLogStore(`drain-${run++}`);
		const network = new Network();
		const start = Date.UTC(2026, 11, 7, 17);
		for (let i = 0; i < 250; i++) {
			const at = { id: v7({ msecs: start + i, seq: 0 }), sessionDate: '2026-12-07', loggedAt: new Date(start + i).toISOString(), deviceId: 'phone-1' };
			if (i % 5 === 0) {
				await store.saveSession({ kind: 'session', ...at, rpe: 7 });
				continue;
			}
			await store.save({ ...at, blockIndex: 1, prescriptionIndex: 0, setIndex: i, movement: 'pull_up', reps: 5 });
		}
		expect(await syncOutbox(store, network.transport), '[drain] the sync reports every record').toEqual({ kind: 'synced', count: 250 });
		expect(await store.pendingCount(), '[drain] nothing is left pending').toBe(0);
		expect(network.sent, '[drain] it took three batches').toHaveLength(3);
		expect([...(await allLogRecords(db)), ...(await allSessionRecords(db))], '[server] the server holds all 250').toHaveLength(250);
		store.close();
	});
});

describe('POST /api/sync', () => {
	it('rejects a wrong token and a malformed batch without writing', async () => {
		await db.delete(logEntries);
		await db.delete(sessionLogs);
		expect((await post('{"records":[]}', 'nope')).status).toBe(401);
		expect((await post('not json')).status).toBe(400);
		expect((await post('{"records":[]}')).status).toBe(400);
		expect((await post('{"records":[{"id":"x"}]}')).status).toBe(400);
		const session = { kind: 'session', id: v7(), sessionDate: '2026-12-07', rpe: 8.5, loggedAt: '2026-12-07T17:00:00Z', deviceId: 'phone-1', revision: 1 };
		expect((await post(JSON.stringify({ records: [session] }))).status).toBe(400);
		expect((await post(JSON.stringify({ records: [{ ...session, rpe: 8, kind: 'set' }] }))).status).toBe(400);
		expect(await allLogRecords(db)).toEqual([]);
		expect(await allSessionRecords(db)).toEqual([]);
	});
});
