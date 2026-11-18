import { expect, test, type Locator, type Page } from '@playwright/test';
import { estimatedOneRm } from '../src/lib/domain/strength.ts';
import { openOn } from './clock.ts';
import { captureEvidence } from './evidence.ts';
import { serverRows } from './server-db.ts';
import { e2eSyncToken } from './sync-env.ts';

interface StoredRecord {
	id: string;
	pending: 0 | 1;
	record: { kind?: 'session'; reps: number; load?: number; rpe?: number; note?: string; deletedAt?: string; setIndex: number; revision: number };
}

const logDate = '2027-01-25';

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

async function settled(swap: Locator): Promise<void> {
	await swap.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
	await expect(swap).toHaveCSS('opacity', '1');
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
	await expect(page.getByText('155', { exact: true })).toBeVisible();
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
	await expect(saved.getByText(`Estimated max ${estimatedOneRm(155, 6)} lb`)).toBeVisible();
	await expect(page.getByRole('timer')).toHaveText('1:30');
	const swapMs = await saved.evaluate((el) => Math.max(...getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d) * 1000)));
	expect(swapMs).toBeGreaterThan(0);
	expect(swapMs).toBeLessThan(250);
	await settled(saved);
	await captureEvidence(page, testInfo, 'saved-rest');

	await page.getByRole('button', { name: 'Next: 175 × 5' }).click();
	await expect(page.getByText('Back squat · 2 of 3')).toBeVisible();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(saved.getByText(`Estimated max ${estimatedOneRm(175, 5)} lb`)).toBeVisible();

	await page.getByRole('button', { name: 'Next: 200 × 5+' }).click();
	await expect(page.getByText('Back squat · 3 of 3')).toBeVisible();
	await expect(page.getByText('lb · 5 or more reps')).toBeVisible();
	await page.getByRole('button', { name: 'Add a note' }).click();
	await page.getByRole('combobox', { name: 'Effort (RPE)' }).selectOption('8');
	await page.getByRole('textbox', { name: 'Note' }).fill('Moved well');
	await settled(page.getByTestId('note'));
	await captureEvidence(page, testInfo, 'note-open');
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(saved.getByText(`Estimated max ${estimatedOneRm(200, 5)} lb`)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Next: 3 × 5 at 155' })).toBeVisible();

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

	const stored = await serverRows('log_entries', logged.map((r) => r.id));
	expect(stored.map((row) => [row.id, row.set_index, row.reps, row.load, row.rpe, row.note, row.revision, row.deleted_at])).toEqual(
		logged
			.map((r) => [r.id, r.record.setIndex, r.record.reps, r.record.load, r.record.rpe ?? null, r.record.note ?? null, r.record.revision, null])
			.toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))
	);
});

const planWeekDays = Array.from({ length: 6 }, (_, i) => new Date(Date.parse(`${logDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
const stepTitle = (page: Page) => page.locator('header .title');
const sessionRpe = (page: Page) => page.getByText('session RPE').locator('xpath=preceding-sibling::span');
const scoreBox = (page: Page) => page.getByRole('textbox', { name: /^(Time|Rounds \+ reps)$/ });

async function logDays(page: Page): Promise<{ date: string; sets: boolean }[]> {
	const days = [];
	for (const date of planWeekDays) {
		const response = await page.goto(`/log/${date}`);
		if (response?.status() === 404) continue;
		await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
		days.push({ date, sets: (await stepTitle(page).textContent()) !== 'Session' });
	}
	return days;
}

async function throughTheSets(page: Page): Promise<string> {
	const next = page.getByRole('button', { name: /^Next: / });
	let lastNext = '';
	for (let set = 0; set < 60 && (await stepTitle(page).textContent()) !== 'Session'; set++) {
		await page.getByRole('button', { name: 'Done' }).click();
		await expect(next).toBeVisible();
		lastNext = (await next.textContent()) ?? '';
		await next.click();
	}
	await expect(stepTitle(page)).toHaveText('Session');
	return lastNext;
}

async function sessionStep(page: Page): Promise<{ rpe: number }> {
	await expect(stepTitle(page)).toHaveText('Session');
	const rpe = Number(await sessionRpe(page).textContent());
	expect(rpe).toBeGreaterThanOrEqual(1);
	await expect(page.getByRole('button', { name: 'Harder' })).toHaveCSS('transition-duration', '0s');
	await page.getByRole('button', { name: rpe < 10 ? 'Harder' : 'Easier' }).click();
	const chosen = rpe < 10 ? rpe + 1 : rpe - 1;
	await expect(sessionRpe(page)).toHaveText(String(chosen));
	return { rpe: chosen };
}

test('a session with no sets is started from Today, logged offline with its RPE, and reaches the server', async ({ page, context }, testInfo) => {
	await openOn(page, logDate, '/sync');
	await untilServiceWorkerControls(page);
	await saveToken(page);
	const day = (await logDays(page)).find((d) => !d.sets);
	expect(day, 'the first plan week has a session without sets').toBeDefined();
	const date = day!.date;

	await page.clock.setFixedTime(new Date(`${date}T09:00:00`));
	await page.goto('/');
	await page.getByRole('link', { name: 'Start' }).click();
	await expect(page).toHaveURL(`/log/${date}`);

	await context.setOffline(true);
	await expect(page.getByRole('link', { name: 'Offline' })).toBeVisible();
	const { rpe } = await sessionStep(page);
	await page.getByRole('button', { name: 'Add a note' }).click();
	await page.getByRole('textbox', { name: 'Note' }).fill('Easy legs');
	await settled(page.getByTestId('note'));
	await captureEvidence(page, testInfo, 'session-no-sets');
	await page.getByRole('button', { name: 'Done' }).click();
	const saved = page.getByTestId('saved');
	await expect(saved.getByText('Session saved')).toBeVisible();
	await expect(saved).toContainText(`RPE ${rpe}`);
	await expect(page.getByRole('link', { name: 'Finish' })).toBeVisible();

	const [logged, ...others] = await localRecords(page);
	expect(others).toEqual([]);
	expect(logged).toMatchObject({ pending: 1, record: { kind: 'session', sessionDate: date, rpe, note: 'Easy legs', revision: 1 } });

	await page.reload();
	await expect(saved.getByText('Session saved')).toBeVisible();
	expect(await localRecords(page)).toEqual([logged]);

	const accepted = syncAccepted(page);
	await context.setOffline(false);
	expect(((await (await accepted).json()) as { accepted: string[] }).accepted).toEqual([logged!.id]);
	await expect.poll(async () => (await localRecords(page)).map((r) => r.pending)).toEqual([0]);
	const [row, ...extra] = await serverRows('session_logs', [logged!.id]);
	expect(extra).toEqual([]);
	expect(row).toMatchObject({ id: logged!.id, session_date: date, rpe, note: 'Easy legs', revision: 1, deleted_at: null, score_type: null });
});

test('a session with sets ends with one Session step after the last set', async ({ page }, testInfo) => {
	await openOn(page, logDate, '/');
	const day = (await logDays(page)).find((d) => d.sets);
	expect(day, 'the first plan week has a session with sets').toBeDefined();
	await page.clock.setFixedTime(new Date(`${day!.date}T09:00:00`));
	await page.goto(`/log/${day!.date}`);

	expect(await throughTheSets(page)).toBe('Next: Session');
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Add a note' })).toBeVisible();
	const { rpe } = await sessionStep(page);
	await settled(page.locator('.session-fields'));
	await captureEvidence(page, testInfo, 'session-step');
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByTestId('saved')).toContainText(`RPE ${rpe}`);
	await expect(page.getByRole('link', { name: 'Finish' })).toBeVisible();
	const sessions = (await localRecords(page)).filter((r) => r.record.kind === 'session');
	expect(sessions.map((r) => r.record.rpe)).toEqual([rpe]);
});

test('a scored session takes its score in the right keyboard and quietly refuses what does not parse', async ({ page }, testInfo) => {
	await openOn(page, logDate, '/sync');
	await saveToken(page);
	let scored: string | undefined;
	for (const { date } of (await logDays(page)).toSorted((a, b) => Number(a.sets) - Number(b.sets))) {
		await page.goto(`/log/${date}`);
		await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
		await throughTheSets(page);
		if ((await scoreBox(page).count()) > 0) {
			scored = date;
			break;
		}
	}
	expect(scored, 'the plan week has a scored session').toBeDefined();

	const box = scoreBox(page);
	await expect(box).toBeVisible();
	const time = (await page.getByRole('textbox', { name: 'Time' }).count()) > 0;
	await expect(box).toHaveAttribute('inputmode', time ? 'numeric' : 'tel');
	await expect(box).toHaveCSS('font-size', '16px');
	await box.fill(time ? '475' : '5+');
	await expect(box).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByText(time ? 'Use m:ss' : 'Use rounds+reps')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();

	await box.fill(time ? '1834' : '5+12');
	if (time) await expect(box).toHaveValue('18:34');
	await expect(box).toHaveAttribute('aria-invalid', 'false');
	await expect(page.getByText(/^Use /)).toHaveCount(0);
	await captureEvidence(page, testInfo, 'session-score');

	const accepted = syncAccepted(page);
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByTestId('saved')).toContainText(time ? '18:34' : '5+12');
	await accepted;
	const logged = (await localRecords(page)).find((r) => r.record.kind === 'session');
	await expect.poll(async () => (await serverRows('session_logs', [logged!.id])).map((row) => [row.score_type, row.score_value])).toEqual([
		time ? ['time', 1114] : ['rounds_reps', 5.012]
	]);
});

test('without a token a set waits as Not synced, and the token entered once on /sync sends it', async ({ page }) => {
	await openOn(page, logDate, `/log/${logDate}`);
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByTestId('saved').getByText('5 reps saved')).toBeVisible();

	await page.getByRole('link', { name: 'Not synced' }).click();
	await expect(page).toHaveURL('/sync');
	await expect(page.getByText('1 entry waiting to sync')).toBeVisible();

	const accepted = syncAccepted(page);
	await saveToken(page);
	await accepted;
	await expect(page.getByText('0 entries waiting to sync')).toBeVisible();
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
