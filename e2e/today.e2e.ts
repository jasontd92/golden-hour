import { expect, test } from '@playwright/test';

test('today renders in the design tokens', async ({ page }, testInfo) => {
	await page.goto('/');
	const heading = page.getByRole('heading', { level: 1, name: 'Today' });
	await expect(heading).toBeVisible();
	await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(6, 9, 11)');
	await expect(heading).toHaveCSS('color', 'rgb(238, 244, 243)');
	await page.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true });
});
