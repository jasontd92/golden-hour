import { expect, test, type Page } from '@playwright/test';
import { openOn } from './clock.ts';
import { captureEvidence } from './evidence.ts';

const pane = (page: Page) => page.getByRole('complementary', { name: 'Selected' });
const grid = (page: Page) => page.getByRole('grid', { name: 'Weeks and days' });
const cell = (page: Page, name: RegExp) => grid(page).getByRole('button', { name });

async function seedLog(page: Page, records: { id: string; sessionDate: string; kind?: 'session' }[]): Promise<void> {
	await page.evaluate(
		(seeded) =>
			new Promise<void>((done, fail) => {
				const open = indexedDB.open('golden-hour-log', 1);
				open.onupgradeneeded = () => {
					open.result.createObjectStore('records', { keyPath: 'id' }).createIndex('pending', 'pending');
				};
				open.onerror = () => fail(open.error);
				open.onsuccess = () => {
					const tx = open.result.transaction('records', 'readwrite');
					for (const record of seeded) tx.objectStore('records').put({ id: record.id, pending: 1, record: { ...record, revision: 1 } });
					tx.oncomplete = () => {
						open.result.close();
						done();
					};
				};
			}),
		records
	);
}

test('the default view at desktop width is Plan, with today open in the pane', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-09');
	await seedLog(page, [
		{ id: '01938a5e-0000-7000-8000-000000000001', sessionDate: '2026-12-07' },
		{ id: '01938a5e-0000-7000-8000-000000000002', sessionDate: '2026-12-08', kind: 'session' }
	]);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Week 1 of 17' })).toBeVisible();
	await expect(page.getByText('Evolution 5 · Dec 7 – Apr 4')).toBeVisible();
	await expect(grid(page).getByRole('row')).toHaveCount(18);
	await expect(grid(page).getByRole('columnheader').filter({ hasText: /^Mon\s*Squat$/ })).toBeVisible();
	await expect(grid(page).getByRole('columnheader').filter({ hasText: 'Sun' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('link', { name: 'Start' })).toHaveCount(0);
	const today = cell(page, /^Wed Dec 9, Threshold intervals, hard, scaled, today$/);
	await expect(today).toHaveAttribute('aria-pressed', 'true');
	await expect(today).toHaveCSS('box-shadow', /rgb\(47, 216, 198\)/);
	await expect(cell(page, /^Mon Dec 7, .*, logged$/)).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.05)');
	await expect(cell(page, /^Tue Dec 8, .*, logged$/)).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.05)');
	await expect(cell(page, /^Thu Dec 10, /)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(cell(page, /^Mon Dec 28, Squat \+ Grace/)).toHaveText('Grace');
	await expect(cell(page, /^Fri Dec 25, Christmas$/)).toHaveText('Christmas');
	await expect(pane(page).getByRole('heading', { level: 2, name: 'Threshold intervals' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(pane(page)).toHaveCount(0);
	await captureEvidence(page, testInfo, 'plan');
});

test('clicking a day opens the pane with that session', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-09');
	await cell(page, /^Fri Dec 11, Deadlift \+ bike/).click();
	await expect(pane(page).getByText('Friday, Dec 11')).toBeVisible();
	await expect(pane(page).getByRole('heading', { level: 2, name: 'Deadlift + bike' })).toBeVisible();
	await pane(page).getByRole('button', { name: /^Deadlift/ }).click();
	await expect(pane(page).getByText(/× 5/).first()).toBeVisible();
	await cell(page, /^Mon Dec 7/).click();
	await expect(pane(page).getByText(/min · Not logged$/)).toBeVisible();
	await captureEvidence(page, testInfo, 'plan-pane');
	await pane(page).getByRole('button', { name: 'Today' }).click();
	await expect(pane(page).getByRole('heading', { level: 2, name: 'Threshold intervals' })).toBeVisible();
	await expect(pane(page).getByRole('button', { name: 'Today' })).toHaveCount(0);
});

test('clicking a week number opens that week’s summary', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-09');
	await cell(page, /^Week 4, Leader, starts Dec 28$/).click();
	await expect(pane(page).getByRole('heading', { level: 2, name: 'Week 4 · Leader' })).toBeVisible();
	await expect(pane(page).getByText('Dec 28 – Jan 3')).toBeVisible();
	const facts = pane(page).locator('dl > div');
	await expect(facts.filter({ hasText: 'Main lifts' })).toContainText('% × 5');
	await expect(facts.filter({ hasText: 'Squat TM' })).toContainText('225');
	await expect(facts.filter({ hasText: 'Press TM' })).toBeVisible();
	await expect(facts.filter({ hasText: 'Deadlift TM' })).toBeVisible();
	await expect(facts.filter({ hasText: 'Long run' })).toContainText('min');
	await expect(facts.filter({ hasText: 'Logged' })).toHaveCount(0);
	await cell(page, /^Week 1, Leader/).click();
	await expect(facts.filter({ hasText: 'Logged' })).toContainText('0 of 6');
	await captureEvidence(page, testInfo, 'week-summary');
});

test('arrow keys move through the grid and Esc closes the pane', async ({ page }) => {
	await openOn(page, '2026-12-09');
	await cell(page, /today$/).focus();
	await page.keyboard.press('ArrowRight');
	await expect(cell(page, /^Thu Dec 10/)).toBeFocused();
	await expect(pane(page).getByText('Thursday, Dec 10')).toBeVisible();
	await page.keyboard.press('ArrowDown');
	await expect(cell(page, /^Thu Dec 17/)).toBeFocused();
	await expect(cell(page, /^Thu Dec 17/)).toHaveCSS('outline-color', 'rgb(47, 216, 198)');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(cell(page, /^Week 2,/)).toBeFocused();
	await expect(pane(page).getByRole('heading', { level: 2, name: 'Week 2 · Leader' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(pane(page)).toHaveCount(0);
});

test('Progress charts Fran and a lift on the 17-week axis', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-09', '/progress');
	await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
	await page.getByRole('button', { name: /^Fran/ }).click();
	const detail = page.getByRole('article', { name: 'Fran' });
	await expect(detail.getByRole('heading', { level: 2, name: 'Fran' })).toBeVisible();
	await expect(detail.locator('dl')).toContainText(/Best\s*4:43/);
	await expect(detail.locator('dl')).toContainText(/Next\s*Wk 8/);
	await expect(detail.getByRole('figure', { name: /^Fran over Evolution 5: start 6:34/ })).toBeVisible();
	await expect(detail.locator('figure circle.point')).toHaveCount(1);
	await expect(detail.getByRole('list', { name: 'Fran history' }).getByRole('listitem')).toHaveCount(2);

	await page.getByRole('button', { name: /^Back squat/ }).click();
	const squat = page.getByRole('article', { name: 'Back squat' });
	await expect(squat.locator('dl')).toContainText(/Best\s*295/);
	await expect(squat.locator('dl')).toContainText(/Target\s*275/);
	await expect(squat.getByRole('figure', { name: /^Back squat over Evolution 5: start 255, target 275$/ })).toBeVisible();
	await expect(squat.locator('figure path.plan')).toHaveCount(1);
	await expect(squat.locator('figure figcaption')).toContainText('Training max');
	await captureEvidence(page, testInfo, 'progress');
});
