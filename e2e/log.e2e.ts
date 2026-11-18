import { expect, test, type Page } from '@playwright/test';
import { estimatedOneRm } from '../src/lib/domain/strength.ts';
import { openOn } from './clock.ts';
import { captureEvidence } from './evidence.ts';
import { e2eSyncToken } from './sync-env.ts';

interface StoredRecord {
	id: string;
	pending: 0 | 1;
	record: { reps: number; load?: number; rpe?: number; note?: string; deletedAt?: string; setIndex: number };
}

const logDate = '2026-12-07';

const bySet = (a: StoredRecord, b: StoredRecord) => a.record.setIndex - b.record.setIndex;

const localRecords = async (page: Page) =>
	(await page.evaluate(
		() =>
			new Promise<StoredRecord[]>((resolve, reject) => {
				const open = indexedDB.open('golden-hour-log');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const all = db.transaction('records').objectStore('records').getAll();
					all.onerror = () => reject(all.error);
					all.onsuccess = () => {
						db.close();
						resolve(all.result as StoredRecord[]);
					};
				};
			})
	)).toSorted(bySet);

async function untilServiceWorkerControls(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (navigator.serviceWorker.controller) return;
		await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
	});
}

async function saveToken(page: Page): Promise<void> {
	await page.getByRole('textbox', { name: 'Sync token' }).fill(e2eSyncToken);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByPlaceholder('Token saved on this device')).toBeVisible();
}

const syncAccepted = (page: Page) =>
	page.waitForResponse((r) => r.url().endsWith('/api/sync') && r.request().method() === 'POST' && r.status() === 200);

test('three sets logged offline survive a reload and reach the API once online', async ({ page, context }, testInfo) => {
	await openOn(page, logDate, '/sync');
	await untilServiceWorkerControls(page);
	await saveToken(page);

	await page.goto('/');
	await page.getByRole('link', { name: 'Start' }).click();
	await expect(page).toHaveURL(`/log/${logDate}`);
	await expect(page.getByText('Back squat · 1 of 3')).toBeVisible();
	await expect(page.getByText('170', { exact: true })).toBeVisible();
	await expect(page.getByText('lb · 5 reps')).toBeVisible();
	await expect(page.getByText('5', { exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
	const stepper = page.getByRole('button', { name: 'One more rep' });
	await expect(stepper).toHaveCSS('transition-duration', '0s');
	await captureEvidence(page, testInfo, 'log-set');

	await context.setOffline(true);
	await expect(page.getByRole('link', { name: 'Offline' })).toBeVisible();

	await stepper.click();
	await expect(page.getByText('6', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Done' }).click();
	const saved = page.getByTestId('saved');
	await expect(saved.getByText('6 reps saved')).toBeVisible();
	await expect(saved.getByText(`Estimated max ${estimatedOneRm(170, 6)} lb`)).toBeVisible();
	await expect(page.getByRole('timer')).toHaveText('1:30');
	const swapMs = await saved.evaluate((el) => Math.max(...getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d) * 1000)));
	expect(swapMs).toBeGreaterThan(0);
	expect(swapMs).toBeLessThan(250);
	await captureEvidence(page, testInfo, 'saved-rest');

	await page.getByRole('button', { name: 'Next: 200 × 5' }).click();
	await expect(page.getByText('Back squat · 2 of 3')).toBeVisible();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(saved.getByText(`Estimated max ${estimatedOneRm(200, 5)} lb`)).toBeVisible();

	await page.getByRole('button', { name: 'Next: 225 × 5+' }).click();
	await expect(page.getByText('Back squat · 3 of 3')).toBeVisible();
	await expect(page.getByText('lb · 5 or more reps')).toBeVisible();
	await page.getByRole('button', { name: 'Add a note' }).click();
	await page.getByRole('combobox', { name: 'Effort (RPE)' }).selectOption('8');
	await page.getByRole('textbox', { name: 'Note' }).fill('Moved well');
	await captureEvidence(page, testInfo, 'note-open');
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(saved.getByText(`Estimated max ${estimatedOneRm(225, 5)} lb`)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Next: 5 × 5 at 170' })).toBeVisible();

	const logged = await localRecords(page);
	expect(logged.map((r) => [r.record.setIndex, r.record.reps, r.pending])).toEqual([
		[0, 6, 1],
		[1, 5, 1],
		[2, 5, 1]
	]);
	expect(logged[2]?.record).toMatchObject({ rpe: 8, note: 'Moved well' });

	await page.reload();
	await expect(page.getByText('Back squat · 3 of 3')).toBeVisible();
	await expect(saved.getByText('5 reps saved')).toBeVisible();
	await expect(page.getByRole('timer')).toHaveText('1:30');
	await expect(page.getByRole('link', { name: 'Offline' })).toBeVisible();
	expect(await localRecords(page)).toEqual(logged);

	const accepted = syncAccepted(page);
	await context.setOffline(false);
	const body = (await (await accepted).json()) as { accepted: string[] };
	expect(body.accepted.toSorted()).toEqual(logged.map((r) => r.id).toSorted());
	await expect.poll(async () => (await localRecords(page)).map((r) => r.pending)).toEqual([0, 0, 0]);
	await expect(page.getByRole('link', { name: 'Offline' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Not synced' })).toHaveCount(0);
});

test('without a token a set waits as Not synced, and the token entered once on /sync sends it', async ({ page }) => {
	await openOn(page, logDate, `/log/${logDate}`);
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByTestId('saved').getByText('5 reps saved')).toBeVisible();

	await page.getByRole('link', { name: 'Not synced' }).click();
	await expect(page).toHaveURL('/sync');
	await expect(page.getByText('1 set waiting to sync')).toBeVisible();

	const accepted = syncAccepted(page);
	await saveToken(page);
	await accepted;
	await expect(page.getByText('0 sets waiting to sync')).toBeVisible();
});

test('Undo tombstones the saved set instead of deleting it', async ({ page }) => {
	await openOn(page, logDate, `/log/${logDate}`);
	await page.getByRole('button', { name: 'Done' }).click();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
	await expect(page.getByText('Back squat · 1 of 3')).toBeVisible();

	const [undone] = await localRecords(page);
	expect(undone).toMatchObject({ pending: 1, record: { setIndex: 0, deletedAt: expect.any(String) } });
});
