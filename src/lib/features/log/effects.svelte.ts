import { untrack } from 'svelte';
import { saveSyncToken, syncToken } from './device.ts';
import { startSyncLoop, type SyncLoop } from './effects.ts';
import type { LogFlow } from './flow.svelte.ts';
import { localLog } from './local.ts';
import { restLeftSeconds } from './rest.ts';
import { httpTransport } from './sync.ts';

let online = $state(true);
let pending = $state(0);
let hasToken = $state(false);
let rejected = $state(false);
let loop: SyncLoop | undefined;

export const logSync = {
	get online() {
		return online;
	},
	get pending() {
		return pending;
	},
	get hasToken() {
		return hasToken;
	},
	get notSynced() {
		return pending > 0 && (!hasToken || rejected);
	}
};

async function countPending(): Promise<void> {
	pending = await (await localLog()).pendingCount();
}

export function requestSync(): void {
	void countPending();
	loop?.request();
}

export function useSyncToken(token: string): void {
	saveSyncToken(token);
	hasToken = Boolean(syncToken());
	rejected = false;
	requestSync();
}

export function keepSyncing(): void {
	$effect(() => {
		let stopped = false;
		const connectivity = () => {
			online = navigator.onLine;
		};
		connectivity();
		hasToken = Boolean(syncToken());
		window.addEventListener('online', connectivity);
		window.addEventListener('offline', connectivity);
		void localLog().then((store) => {
			if (stopped) return;
			loop = startSyncLoop(
				store,
				() => {
					const token = syncToken();
					return token ? httpTransport(token) : undefined;
				},
				(outcome) => {
					rejected = outcome.kind === 'unauthorized';
					void countPending();
				}
			);
			void countPending();
		});
		return () => {
			stopped = true;
			loop?.stop();
			loop = undefined;
			window.removeEventListener('online', connectivity);
			window.removeEventListener('offline', connectivity);
		};
	});
}

const vibrate = () => {
	if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
};

export function restCountdown(endsAt: () => number | undefined): { readonly left: number | undefined } {
	let now = $state(Date.now());
	$effect(() => {
		const end = endsAt();
		if (end === undefined) return;
		let running = end > Date.now();
		const tick = () => {
			now = Date.now();
			if (running && now >= end) {
				running = false;
				vibrate();
			}
		};
		tick();
		const timer = setInterval(tick, 250);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', tick);
		};
	});
	return {
		get left() {
			const end = endsAt();
			return end === undefined ? undefined : restLeftSeconds(end, now);
		}
	};
}

export function resumeOnOpen(flow: LogFlow): void {
	$effect(() => {
		void untrack(() => flow.resume());
	});
}
