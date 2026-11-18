import { expect, test } from '@playwright/test';
import { captureEvidence } from './evidence.ts';

test('progress lists the best benchmarks and lifts', async ({ page }, testInfo) => {
	await page.goto('/progress');
	await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
	const benchmarks = page.getByRole('region', { name: 'Benchmarks' });
	const lifts = page.getByRole('region', { name: 'Lifts · 1 rep max' });
	await expect(benchmarks.getByRole('link', { name: /^Fran\s*4:43$/ })).toBeVisible();
	await expect(benchmarks.getByRole('link', { name: /^CrossFit Total\s*Sources disagree\s*845$/ })).toBeVisible();
	await expect(lifts.getByRole('link', { name: /^Back squat\s*295$/ })).toBeVisible();
	await captureEvidence(page, testInfo, 'progress');
});

test('tapping Fran shows its result history', async ({ page }, testInfo) => {
	await page.goto('/progress');
	await page.getByRole('link', { name: /^Fran/ }).tap();
	await expect(page).toHaveURL(/\/progress\/benchmarks\/fran$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
	const rows = page.getByRole('list', { name: 'Fran results' }).getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('Aug 2025');
	await expect(rows.nth(0)).toContainText('6:34');
	await expect(rows.nth(1)).toContainText('May 11, 2023');
	await expect(rows.nth(1)).toContainText('4:43');
	await captureEvidence(page, testInfo, 'fran-history');
});

test('a lift opens its rep-max history', async ({ page }, testInfo) => {
	await page.goto('/progress/lifts/back-squat');
	await expect(page.getByRole('heading', { level: 1, name: 'Back squat' })).toBeVisible();
	await expect(page.getByRole('list', { name: 'Back squat results' }).getByRole('listitem')).toHaveCount(11);
	await page.getByRole('link', { name: 'Progress' }).tap();
	await expect(page).toHaveURL(/\/progress$/);
	await captureEvidence(page, testInfo, 'back-squat-history');
});
