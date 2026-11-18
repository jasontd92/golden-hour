let waiting = $state<ServiceWorker | undefined>();
let applying = false;

export const appUpdate = {
	get ready() {
		return waiting !== undefined;
	},
	apply() {
		applying = true;
		waiting?.postMessage({ type: 'skip-waiting' });
	}
};

function watchInstall(registration: ServiceWorkerRegistration) {
	const worker = registration.installing;
	worker?.addEventListener('statechange', () => {
		if (worker.state === 'installed' && navigator.serviceWorker.controller) waiting = worker;
	});
}

export function watchServiceWorker(): void {
	$effect(() => {
		if (!('serviceWorker' in navigator)) return;
		let registration: ServiceWorkerRegistration | undefined;
		const checkForUpdate = () => {
			if (document.visibilityState === 'visible') void registration?.update();
		};
		const reloadOnTakeover = () => {
			if (applying) location.reload();
		};
		void navigator.serviceWorker.ready.then((ready) => {
			registration = ready;
			if (ready.waiting && navigator.serviceWorker.controller) waiting = ready.waiting;
			ready.addEventListener('updatefound', () => watchInstall(ready));
		});
		document.addEventListener('visibilitychange', checkForUpdate);
		navigator.serviceWorker.addEventListener('controllerchange', reloadOnTakeover);
		return () => {
			document.removeEventListener('visibilitychange', checkForUpdate);
			navigator.serviceWorker.removeEventListener('controllerchange', reloadOnTakeover);
		};
	});
}
