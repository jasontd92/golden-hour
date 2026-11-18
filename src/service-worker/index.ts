import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { self } from '$app/service-worker';

const cacheName = `golden-hour-${version}`;
const precached = new Set([...immutable, ...assets, ...prerendered].map(({ path }) => new URL(path, self.location.origin + '/').pathname));

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			await cache.addAll([...precached]);
			// why: the first install has no open session to interrupt; updates wait for the reload prompt.
			if (!self.registration.active) await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== cacheName) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	if ((event.data as { type?: unknown } | null)?.type === 'skip-waiting') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== self.location.origin || !precached.has(url.pathname)) return;
	event.respondWith(
		(async () => {
			const cached = await (await caches.open(cacheName)).match(url.pathname);
			return cached ?? fetch(event.request);
		})()
	);
});
