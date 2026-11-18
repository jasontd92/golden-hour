import { describe, expect, it } from 'vitest';
import { LogEntry } from './log.ts';

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
