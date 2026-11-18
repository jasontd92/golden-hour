import { describe, expect, it } from 'vitest';
import { LogEntryId } from '#lib/domain/log.ts';
import { deviceId, saveSyncToken, syncToken } from './device.ts';
import { newLogEntry } from './entry.ts';

const memoryStorage = (): Storage => {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => void items.delete(key),
		setItem: (key, value) => void items.set(key, value)
	};
};

describe('newLogEntry', () => {
	it('stamps a uuid v7 id, the time and the device', () => {
		const now = new Date('2026-12-08T00:42:10.120Z');
		const entry = newLogEntry({ sessionDate: '2026-12-07', blockIndex: 1, prescriptionIndex: 0, setIndex: 2, movement: 'back_squat', load: 225, reps: 5 }, 'phone-1', now);
		expect(LogEntryId.safeParse(entry.id).success).toBe(true);
		expect(entry).toMatchObject({ loggedAt: '2026-12-08T00:42:10.120Z', deviceId: 'phone-1', reps: 5 });
	});
});

describe('device storage', () => {
	it('keeps one device id and the trimmed sync token', () => {
		const storage = memoryStorage();
		expect(syncToken(storage)).toBeUndefined();
		saveSyncToken('  abc  ', storage);
		expect(syncToken(storage)).toBe('abc');
		expect(deviceId(storage)).toBe(deviceId(storage));
	});
});
