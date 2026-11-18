import { describe, expect, it } from 'vitest';
import { formatRest, rememberedRest, rememberRest, restLeftSeconds } from './rest.ts';

class MemoryStorage implements Storage {
	#items = new Map<string, string>();
	get length() {
		return this.#items.size;
	}
	clear = () => this.#items.clear();
	getItem = (key: string) => this.#items.get(key) ?? null;
	key = (index: number) => [...this.#items.keys()][index] ?? null;
	removeItem = (key: string) => void this.#items.delete(key);
	setItem = (key: string, value: string) => void this.#items.set(key, value);
}

describe('rest', () => {
	it('counts down from the stored end time, never below zero', () => {
		expect(restLeftSeconds(90_000, 0)).toBe(90);
		expect(restLeftSeconds(90_000, 500)).toBe(90);
		expect(restLeftSeconds(90_000, 89_001)).toBe(1);
		expect(restLeftSeconds(90_000, 120_000)).toBe(0);
	});

	it('formats minutes and seconds', () => {
		expect(formatRest(90)).toBe('1:30');
		expect(formatRest(5)).toBe('0:05');
		expect(formatRest(0)).toBe('0:00');
	});

	it('remembers the end time across a reload and forgets it on clear or junk', () => {
		const storage = new MemoryStorage();
		const rest = { sessionDate: '2026-12-07', entryId: 'a', endsAt: 1 };
		rememberRest(rest, storage);
		expect(rememberedRest(storage)).toEqual(rest);
		rememberRest(undefined, storage);
		expect(rememberedRest(storage)).toBeUndefined();
		storage.setItem('golden-hour.rest', '{not json');
		expect(rememberedRest(storage)).toBeUndefined();
	});
});
