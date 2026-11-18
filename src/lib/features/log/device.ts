const tokenKey = 'golden-hour.sync-token';
const deviceKey = 'golden-hour.device-id';

export function syncToken(storage: Storage = localStorage): string | undefined {
	return storage.getItem(tokenKey) ?? undefined;
}

export function saveSyncToken(token: string, storage: Storage = localStorage): void {
	storage.setItem(tokenKey, token.trim());
}

export function deviceId(storage: Storage = localStorage): string {
	const existing = storage.getItem(deviceKey);
	if (existing) return existing;
	const created = crypto.randomUUID();
	storage.setItem(deviceKey, created);
	return created;
}
