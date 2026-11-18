import { expect, type Page, type TestInfo } from '@playwright/test';

export async function expectThemeApplied(page: Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready);
	await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(6, 9, 11)');
	await expect(page.locator('body')).toHaveCSS('font-family', /^"?Geist Variable"?,/);
	const geistLoaded = await page.evaluate(() =>
		[...document.fonts].some((face) => face.family.replaceAll('"', '') === 'Geist Variable' && face.status === 'loaded')
	);
	expect(geistLoaded, 'Geist must be loaded before evidence is captured').toBe(true);
}

export async function captureEvidence(page: Page, testInfo: TestInfo, name: string): Promise<void> {
	await expectThemeApplied(page);
	const path = `${testInfo.project.outputDir}/screenshots/${testInfo.project.name}-${name}.png`;
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, { path, contentType: 'image/png' });
}
