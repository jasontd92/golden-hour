import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { captureEvidence } from './evidence.ts';

const tab = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' });

test('progress shows the favorites, the battery and the main lifts, then All', async ({ page }, testInfo) => {
	await page.goto('/progress');
	await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
	const benchmarks = page.getByRole('region', { name: 'Benchmarks' }).getByRole('link');
	const lifts = page.getByRole('region', { name: 'Lifts · 1 rep max' }).getByRole('link');
	await expect(benchmarks).toHaveCount(15);
	await expect(benchmarks.first()).toHaveText(/^Turkey Trot Triple\s*46:18$/);
	await expect(benchmarks.filter({ hasText: /^Fran\s*4:43$/ })).toBeVisible();
	await expect(benchmarks.filter({ hasText: /^CrossFit Total\s*Sources disagree\s*845$/ })).toBeVisible();
	await expect(benchmarks.filter({ hasText: 'King Kong' })).toHaveCount(0);
	await expect(benchmarks.last()).toHaveText(/^All benchmarks\s*21$/);
	await expect(lifts).toHaveCount(5);
	await expect(lifts.first()).toHaveText(/^Deadlift\s*365$/);
	await expect(lifts.filter({ hasText: /^Back squat\s*295$/ })).toBeVisible();
	await expect(lifts.last()).toHaveText(/^All lifts\s*11$/);
	await expect(tab(page)).toHaveAttribute('aria-current', 'page');
	await captureEvidence(page, testInfo, 'progress');
});

test('All opens the full benchmark list', async ({ page }, testInfo) => {
	await page.goto('/progress');
	await page.getByRole('link', { name: /^All benchmarks/ }).tap();
	await expect(page).toHaveURL(/\/progress\/benchmarks$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Benchmarks' })).toBeVisible();
	const rows = page.getByRole('list', { name: 'Benchmarks' }).getByRole('link');
	await expect(rows).toHaveCount(21);
	await expect(rows.filter({ hasText: /^King Kong \(women's Rx\)/ })).toBeVisible();
	await expect(tab(page)).toHaveAttribute('aria-current', 'page');
	await captureEvidence(page, testInfo, 'all-benchmarks');
});

test('All opens the full lift list', async ({ page }, testInfo) => {
	await page.goto('/progress');
	await page.getByRole('link', { name: /^All lifts/ }).tap();
	await expect(page).toHaveURL(/\/progress\/lifts$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Lifts · 1 rep max' })).toBeVisible();
	const rows = page.getByRole('list', { name: 'Lifts · 1 rep max' }).getByRole('link');
	await expect(rows).toHaveCount(11);
	await rows.filter({ hasText: /^Thruster\s*195$/ }).tap();
	await expect(page).toHaveURL(/\/progress\/lifts\/thruster$/);
	await captureEvidence(page, testInfo, 'all-lifts-thruster');
});

test('tapping Fran shows its result history', async ({ page }, testInfo) => {
	await page.goto('/');
	await tab(page).tap();
	await page.getByRole('link', { name: /^Fran/ }).tap();
	await expect(page).toHaveURL(/\/progress\/benchmarks\/fran$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
	await expect(tab(page)).toHaveAttribute('aria-current', 'page');
	const rows = page.getByRole('list', { name: 'Fran results' }).getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('Aug 2025');
	await expect(rows.nth(0)).toContainText('6:34');
	await expect(rows.nth(1)).toContainText('May 11, 2023');
	await expect(rows.nth(1)).toContainText('4:43');
	await captureEvidence(page, testInfo, 'fran-history');
});

test('back squat history starts with the 2026-11-16 CrossFit Total', async ({ page }, testInfo) => {
	await page.goto('/progress');
	await page.getByRole('link', { name: /^Back squat/ }).tap();
	await expect(page).toHaveURL(/\/progress\/lifts\/back-squat$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Back squat' })).toBeVisible();
	const rows = page.getByRole('list', { name: 'Back squat results' }).getByRole('listitem');
	await expect(rows).toHaveCount(12);
	await expect(rows.nth(0)).toContainText('Nov 16, 2026');
	await expect(rows.nth(0)).toContainText('255 × 1');
	await expect(rows.nth(0)).toContainText('Sheet');
	await captureEvidence(page, testInfo, 'back-squat-history');
	await page.locator('header').getByRole('link', { name: 'Progress' }).tap();
	await expect(page).toHaveURL(/\/progress$/);
});

test('a conflicted result explains the marker on its history', async ({ page }, testInfo) => {
	await page.goto('/progress/benchmarks/crossfit-total');
	const rows = page.getByRole('list', { name: 'CrossFit Total results' }).getByRole('listitem');
	await expect(rows.filter({ hasText: 'Sources disagree' })).toHaveCount(1);
	await captureEvidence(page, testInfo, 'crossfit-total-history');
});
