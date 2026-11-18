import { expect, test } from '@playwright/test';
import { captureEvidence } from './evidence.ts';

test('today renders in the design tokens', async ({ page }, testInfo) => {
	await page.goto('/');
	const heading = page.getByRole('heading', { level: 1, name: 'Today' });
	await expect(heading).toBeVisible();
	await expect(heading).toHaveCSS('color', 'rgb(238, 244, 243)');
	await captureEvidence(page, testInfo, 'today');
});
