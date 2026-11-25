import { writeFileSync } from 'node:fs';
import path from 'node:path';
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
	const file = `${testInfo.project.outputDir}/screenshots/${testInfo.project.name}-${name}.png`;
	await page.screenshot({ path: file, fullPage: true });
	await testInfo.attach(name, { path: file, contentType: 'image/png' });
	// why: the PR comment shows only screenshots of pages the PR touched, so each one records its page and spec
	const spec = path.relative(testInfo.config.rootDir, testInfo.file);
	writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify({ page: new URL(page.url()).pathname, spec }));
}
