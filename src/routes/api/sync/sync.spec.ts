import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { v7 } from 'uuid';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { LogEntry, LogRecord, SyncRequest } from '#lib/domain/log.ts';
import { openLogStore } from '#lib/features/log/store.ts';
import { syncOutbox, type Transport } from '#lib/features/log/sync.ts';
import type { Db } from '#lib/server/db/client.ts';
import { allLogRecords } from '#lib/server/db/log-entries.ts';
import { logEntries } from '#lib/server/db/schema.ts';
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

class Network {
	online = true;
	loseNextResponse = false;
	inFlight: (() => Promise<void>) | undefined;
	readonly sent: string[] = [];

	readonly transport: Transport = async (request: SyncRequest) => {
		if (!this.online) throw new TypeError('Failed to fetch');
		const body = JSON.stringify(request);
		this.sent.push(body);
		const response = await post(body);
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

const command = fc.oneof(
	{ weight: 4, arbitrary: setFields.map((set) => ({ kind: 'log' as const, set })) },
	{ weight: 2, arbitrary: fc.nat().map((pick) => ({ kind: 'undo' as const, pick })) },
	{ weight: 1, arbitrary: fc.tuple(fc.nat(), fc.integer({ min: 2, max: 20 })).map(([pick, rpe]) => ({ kind: 'amend' as const, pick, rpe: rpe / 2 })) },
	{ weight: 1, arbitrary: fc.constant({ kind: 'offline' as const }) },
	{ weight: 1, arbitrary: fc.constant({ kind: 'online' as const }) },
	{ weight: 2, arbitrary: fc.constant({ kind: 'sync' as const }) },
	{ weight: 2, arbitrary: fc.constant({ kind: 'interruptedSync' as const }) },
	{ weight: 1, arbitrary: fc.nat().map((pick) => ({ kind: 'undoDuringSync' as const, pick })) },
	{ weight: 2, arbitrary: fc.nat().map((pick) => ({ kind: 'replaySync' as const, pick })) }
);
type Command = typeof command extends fc.Arbitrary<infer C> ? C : never;

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
const content = ({ revision, deletedAt, ...entry }: LogRecord): LogEntry => entry;

let run = 0;

async function play(commands: Command[]) {
	await db.delete(logEntries);
	const store = await openLogStore(`property-${run++}`);
	const network = new Network();
	const live = new Map<string, LogEntry>();
	const pickLive = (pick: number) => [...live.keys()][pick % live.size];
	const undo = async (id: string) => {
		await store.undo(id, new Date(Date.UTC(2026, 11, 7, 18)));
		live.delete(id);
	};
	const sync = () => syncOutbox(store, network.transport, 3);
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
			await store.save(entry);
			live.set(entry.id, entry);
		} else if (step.kind === 'undo' && live.size > 0) {
			await undo(pickLive(step.pick)!);
		} else if (step.kind === 'amend' && live.size > 0) {
			const id = pickLive(step.pick)!;
			await store.amend(id, { rpe: step.rpe });
			live.set(id, { ...live.get(id)!, rpe: step.rpe });
		} else if (step.kind === 'offline') {
			network.online = false;
		} else if (step.kind === 'online') {
			network.online = true;
		} else if (step.kind === 'sync') {
			await sync();
		} else if (step.kind === 'interruptedSync') {
			network.loseNextResponse = true;
			await sync();
			network.loseNextResponse = false;
		} else if (step.kind === 'undoDuringSync' && live.size > 0) {
			const id = pickLive(step.pick)!;
			network.inFlight = () => undo(id);
			await sync();
			if (network.inFlight) await network.inFlight();
		} else if (step.kind === 'replaySync' && network.sent.length > 0) {
			await post(network.sent[step.pick % network.sent.length]!);
		}
	}

	network.online = true;
	for (let attempt = 0; attempt < 3 && (await store.pendingCount()) > 0; attempt++) await sync();

	const server = await allLogRecords(db);
	const result = {
		expected: [...live.values()].sort(byId),
		client: (await store.entries()).map(content).sort(byId),
		server: server.filter((record) => !record.deletedAt).map(content).sort(byId),
		serverIds: server.length,
		distinctServerIds: new Set(server.map((record) => record.id)).size,
		pending: await store.pendingCount()
	};
	store.close();
	return result;
}

describe('hold-the-line A: no log entry is ever lost', () => {
	it('the server ends with exactly the client\'s non-undone entries, whatever the network does', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(command, { maxLength: 40 }), async (commands) => {
				const { expected, client, server, serverIds, distinctServerIds, pending } = await play(commands);
				expect(client).toStrictEqual(expected);
				expect(server).toStrictEqual(expected);
				expect(serverIds).toBe(distinctServerIds);
				expect(pending).toBe(0);
			}),
			{ numRuns: 300 }
		);
	}, 120_000);

	it('positive control: a scripted interrupted, raced and replayed history converges', async () => {
		const set = { movement: 'back_squat' as const, reps: 5, load: 225 };
		const result = await play([
			{ kind: 'log', set },
			{ kind: 'interruptedSync' },
			{ kind: 'log', set },
			{ kind: 'undoDuringSync', pick: 0 },
			{ kind: 'replaySync', pick: 0 },
			{ kind: 'offline' },
			{ kind: 'log', set },
			{ kind: 'amend', pick: 1, rpe: 8 },
			{ kind: 'sync' }
		]);
		expect(result.expected).toHaveLength(2);
		expect(result.server).toStrictEqual(result.expected);
		expect(result.pending).toBe(0);
	});
});

describe('POST /api/sync', () => {
	it('rejects a wrong token and a malformed batch without writing', async () => {
		await db.delete(logEntries);
		expect((await post('{"records":[]}', 'nope')).status).toBe(401);
		expect((await post('not json')).status).toBe(400);
		expect((await post('{"records":[]}')).status).toBe(400);
		expect((await post('{"records":[{"id":"x"}]}')).status).toBe(400);
		expect(await allLogRecords(db)).toEqual([]);
	});
});
