import { expect, test } from '@playwright/test';
import { openOn } from './clock.ts';

test('the manifest is linked and installable as a standalone dark app', async ({ page, request }) => {
	await page.goto('/');
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	expect(href).toBeTruthy();
	const manifest = await (await request.get(new URL(href ?? '', page.url()).href)).json();
	expect(manifest).toMatchObject({
		name: 'Golden Hour',
		display: 'standalone',
		start_url: '/',
		theme_color: '#06090b',
		background_color: '#06090b'
	});
	for (const icon of manifest.icons as { src: string }[]) {
		expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
	}
});

test('after the first load, Today and Week render offline', async ({ page, context }) => {
	await openOn(page, '2026-11-17');
	await expect(page.getByRole('heading', { level: 1, name: 'Squat + short sprint' })).toBeVisible();
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (navigator.serviceWorker.controller) return;
		await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
	});

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Squat + short sprint' })).toBeVisible();
	await page.getByRole('link', { name: 'Week' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Week 1 of 17' })).toBeVisible();
	await page.getByRole('link', { name: /Long chipper/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Long chipper' })).toBeVisible();
});
