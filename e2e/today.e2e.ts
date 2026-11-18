import { expect, test } from '@playwright/test';
import { openOn } from './clock.ts';
import { captureEvidence } from './evidence.ts';

test('before the plan starts, Today shows the first session with its date', async ({ page }, testInfo) => {
	await openOn(page, '2026-11-17');
	const heading = page.getByRole('heading', { level: 1, name: 'Squat + couplet' });
	await expect(heading).toBeVisible();
	await expect(heading).toHaveCSS('color', 'rgb(238, 244, 243)');
	await expect(page.getByText('Monday, Dec 7')).toBeVisible();
	await expect(page.getByText('55 min')).toBeVisible();
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/log/2026-12-07');
	await expect(page.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
	await captureEvidence(page, testInfo, 'today');
});

test('week 1 Monday: Leader squat sets from TM 215, then the hard couplet', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-07');
	await expect(page.getByRole('heading', { level: 1, name: 'Squat + couplet' })).toBeVisible();
	await page.getByRole('button', { name: /^Back squat/ }).click();
	await expect(page.getByText('185 × 5', { exact: true })).toBeVisible();
	await expect(page.getByText('5 × 5 at 140')).toBeVisible();
	await captureEvidence(page, testInfo, 'today-week-1');
});

test('week 4: Friday moves to Thursday for New Year, and the holiday itself is rest', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-31');
	await expect(page.getByRole('heading', { level: 1, name: 'Mile TT + deadlift' })).toBeVisible();
	await expect(page.getByText('Thursday', { exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(1);
	await page.getByRole('button', { name: /^Mile time trial/ }).click();
	await expect(page.getByText('1 mi run')).toBeVisible();
	await captureEvidence(page, testInfo, 'today-week-4');

	await openOn(page, '2027-01-01');
	await expect(page.getByRole('heading', { level: 1, name: 'Rest' })).toBeVisible();
});

test('a block expands to its prescription on tap, one at a time, and collapses on a second tap', async ({ page }, testInfo) => {
	await openOn(page, '2027-01-25');
	const squat = page.getByRole('button', { name: /^Back squat/ });
	const fran = page.getByRole('button', { name: /^Fran/ });
	const topSet = page.getByText('200 × 5+');

	await expect(topSet).toHaveCount(0);
	await squat.click();
	await expect(squat).toHaveAttribute('aria-expanded', 'true');
	await expect(topSet).toBeVisible();
	await expect(topSet).toHaveCSS('font-weight', '600');
	await captureEvidence(page, testInfo, 'today-expanded');

	await fran.click();
	await expect(page.getByText('21 thrusters, 95 lb')).toBeVisible();
	await expect(topSet).toHaveCount(0);

	await fran.click();
	await expect(fran).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByText('21 thrusters, 95 lb')).toHaveCount(0);
});

test('"Why this session" discloses the reason and hides it again', async ({ page }) => {
	await openOn(page, '2026-12-07');
	const why = page.getByText('Leader block: 5s at every step');
	await expect(why).toHaveCount(0);
	await page.getByRole('button', { name: 'Why this session' }).click();
	await expect(why).toBeVisible();
	await page.getByRole('button', { name: 'Hide why' }).click();
	await expect(why).toHaveCount(0);
});

test("today's date picks the session, and a day without one is rest", async ({ page }) => {
	await openOn(page, '2026-12-10');
	await expect(page.getByRole('heading', { level: 1, name: 'Z1 run + gymnastics' })).toBeVisible();
	await expect(page.getByText('Thursday', { exact: true })).toBeVisible();

	await openOn(page, '2026-12-13');
	await expect(page.getByRole('heading', { level: 1, name: 'Rest' })).toBeVisible();
});

test('phones default to Today, not the desktop Plan', async ({ page }) => {
	await openOn(page, '2026-12-09');
	await expect(page.getByRole('heading', { level: 1, name: 'Threshold intervals' })).toBeVisible();
	await expect(page.getByRole('grid', { name: 'Weeks and days' })).toHaveCount(0);
	await expect(page.locator('[data-view="desk"]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
});
