import { expect, test } from './test.ts';
import { openOn } from './clock.ts';
import { captureEvidence } from './evidence.ts';

test('Week lists seven days with today highlighted and Sunday as rest', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-09', '/week');
	await expect(page.getByRole('heading', { level: 1, name: 'Week 1 of 17' })).toBeVisible();
	await expect(page.getByText('Dec 7 – 13')).toBeVisible();
	const rows = page.locator('main .row');
	await expect(rows).toHaveCount(7);
	await expect(rows.last()).toHaveText(/Sun\s*Rest/);
	const today = page.locator('[aria-current="date"]');
	await expect(today).toHaveText(/Wed\s*Threshold intervals/);
	await expect(today.getByText('Wed')).toHaveCSS('color', 'rgb(47, 216, 198)');
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(3);
	await expect(page.getByRole('link', { name: 'Week' })).toHaveAttribute('aria-current', 'page');
	await captureEvidence(page, testInfo, 'week');
});

test("tapping a day opens that day's session, and today's row opens Today", async ({ page }) => {
	await openOn(page, '2026-12-09', '/week');
	await page.getByRole('link', { name: /Deadlift \+ bike/ }).click();
	await expect(page).toHaveURL(/\/day\/2026-12-11$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Deadlift + bike' })).toBeVisible();
	await expect(page.getByText('Friday, Dec 11')).toBeVisible();

	await page.getByRole('link', { name: 'Week' }).click();
	await page.getByRole('link', { name: /Threshold intervals/ }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Threshold intervals' })).toBeVisible();
});
