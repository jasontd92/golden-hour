import { expect, test } from '@playwright/test';
import { openOn } from './clock.ts';
import { captureEvidence } from './evidence.ts';

test('before the plan starts, Today shows the first session with its date', async ({ page }, testInfo) => {
	await openOn(page, '2026-11-17');
	const heading = page.getByRole('heading', { level: 1, name: 'Squat + short sprint' });
	await expect(heading).toBeVisible();
	await expect(heading).toHaveCSS('color', 'rgb(238, 244, 243)');
	await expect(page.getByText('Monday, Dec 7')).toBeVisible();
	await expect(page.getByText('50 min')).toBeVisible();
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/log/2026-12-07');
	await expect(page.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
	await captureEvidence(page, testInfo, 'today');
});

test('a block expands to its prescription on tap, one at a time, and collapses on a second tap', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-07');
	const squat = page.getByRole('button', { name: /^Back squat/ });
	const amrap = page.getByRole('button', { name: /^AMRAP 12/ });
	const topSet = page.getByText('225 × 5+');

	await expect(topSet).toHaveCount(0);
	await squat.click();
	await expect(squat).toHaveAttribute('aria-expanded', 'true');
	await expect(topSet).toBeVisible();
	await expect(topSet).toHaveCSS('font-weight', '600');
	await captureEvidence(page, testInfo, 'today-expanded');

	await amrap.click();
	await expect(page.getByText('8 DB snatches, 45 lb')).toBeVisible();
	await expect(topSet).toHaveCount(0);

	await amrap.click();
	await expect(amrap).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByText('8 DB snatches, 45 lb')).toHaveCount(0);
});

test('"Why this session" discloses the reason and hides it again', async ({ page }) => {
	await openOn(page, '2026-12-07');
	const why = page.getByText('Your top squat set resets the training max');
	await expect(why).toHaveCount(0);
	await page.getByRole('button', { name: 'Why this session' }).click();
	await expect(why).toBeVisible();
	await page.getByRole('button', { name: 'Hide why' }).click();
	await expect(why).toHaveCount(0);
});

test("today's date picks the session, and a day without one is rest", async ({ page }) => {
	await openOn(page, '2026-12-10');
	await expect(page.getByRole('heading', { level: 1, name: 'Track intervals' })).toBeVisible();
	await expect(page.getByText('Thursday', { exact: true })).toBeVisible();

	await openOn(page, '2026-12-13');
	await expect(page.getByRole('heading', { level: 1, name: 'Rest' })).toBeVisible();
});
