import type { LogStore } from './store.ts';
import { syncOutbox, type SyncOutcome, type Transport } from './sync.ts';

export const retryDelayMs = (attempt: number) => Math.min(60_000, 1_000 * 2 ** attempt);

export interface SyncLoop {
	request(): void;
	stop(): void;
}

export function startSyncLoop(
	store: LogStore,
	transport: () => Transport | undefined,
	onOutcome: (outcome: SyncOutcome) => void = () => {},
	target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window
): SyncLoop {
	let running = false;
	let again = false;
	let stopped = false;
	let attempt = 0;
	let retry: ReturnType<typeof setTimeout> | undefined;

	async function run(): Promise<void> {
		const send = transport();
		if (stopped || !send) return;
		if (running) {
			again = true;
			return;
		}
		running = true;
		clearTimeout(retry);
		const outcome = await syncOutbox(store, send).catch((): SyncOutcome => ({ kind: 'failed', status: 0 }));
		running = false;
		onOutcome(outcome);
		if (outcome.kind === 'synced') attempt = 0;
		else if (outcome.kind !== 'unauthorized' && !stopped) retry = setTimeout(request, retryDelayMs(attempt++));
		if (again) {
			again = false;
			request();
		}
	}

	function request(): void {
		void run();
	}

	target.addEventListener('online', request);
	request();
	return {
		request,
		stop() {
			stopped = true;
			clearTimeout(retry);
			target.removeEventListener('online', request);
		}
	};
}
