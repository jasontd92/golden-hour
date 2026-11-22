import { disclosure, expect, expectDisclosure, hydrated, openDisclosure, test } from './test.ts';
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
	await openDisclosure(page, /^Back squat/);
	await expect(page.getByText('185 × 5', { exact: true })).toBeVisible();
	await expect(page.getByText('5 × 5 at 140')).toBeVisible();
	await captureEvidence(page, testInfo, 'today-week-1');
});

test('week 4: Friday moves to Thursday for New Year, and the holiday itself is rest', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-31');
	await expect(page.getByRole('heading', { level: 1, name: 'Mile TT + deadlift' })).toBeVisible();
	await expect(page.getByText('Thursday', { exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(1);
	await openDisclosure(page, /^Mile time trial/);
	await expect(page.getByText('1 mi run')).toBeVisible();
	await captureEvidence(page, testInfo, 'today-week-4');

	await openOn(page, '2027-01-01');
	await expect(page.getByRole('heading', { level: 1, name: 'Rest' })).toBeVisible();
});

test('a block expands to its prescription on tap, one at a time, and collapses on a second tap', async ({ page }, testInfo) => {
	await openOn(page, '2027-01-25');
	const squat = disclosure(page, /^Back squat/);
	const fran = disclosure(page, /^Fran/);
	const topSet = page.getByText('200 × 5+');
	const thrusters = page.getByText('21 thrusters, 95 lb');

	await expect(topSet).toBeHidden();
	await expectDisclosure(squat, { name: /^Back squat/, expanded: false });
	await squat.click();
	await expectDisclosure(squat, { name: /^Back squat/, expanded: true });
	await expect(topSet).toBeVisible();
	await expect(topSet).toHaveCSS('font-weight', '600');
	await captureEvidence(page, testInfo, 'today-expanded');

	await fran.click();
	await expectDisclosure(fran, { name: /^Fran/, expanded: true });
	await expectDisclosure(squat, { name: /^Back squat/, expanded: false });
	await expect(thrusters).toBeVisible();
	await expect(topSet).toBeHidden();

	await fran.click();
	await expectDisclosure(fran, { name: /^Fran/, expanded: false });
	await expect(thrusters).toBeHidden();
});

test('"Why this session" discloses the reason and hides it again', async ({ page }) => {
	await openOn(page, '2026-12-07');
	const why = page.getByText('Leader block: 5s at every step');
	await expect(why).toBeHidden();
	await expectDisclosure(disclosure(page, 'Why this session'), { name: 'Why this session', expanded: false });
	await disclosure(page, 'Why this session').click();
	await expectDisclosure(disclosure(page, 'Hide why'), { name: 'Hide why', expanded: true });
	await expect(why).toBeVisible();
	await disclosure(page, 'Hide why').click();
	await expectDisclosure(disclosure(page, 'Why this session'), { name: 'Why this session', expanded: false });
	await expect(why).toBeHidden();
});

test.describe('before the app script runs', () => {
	test.use({ javaScriptEnabled: false });

	test('with JavaScript off, a block and "Why this session" still open on tap', async ({ page }) => {
		await page.goto('/day/2026-12-07');
		await expect(page.getByRole('heading', { level: 1, name: 'Squat + couplet' })).toBeVisible();
		await openDisclosure(page, /^Back squat/);
		await expect(page.getByText('5 × 5 at 140')).toBeVisible();
		await disclosure(page, 'Why this session').click();
		await expectDisclosure(disclosure(page, 'Hide why'), { name: 'Hide why', expanded: true });
		await expect(page.getByText('Leader block: 5s at every step')).toBeVisible();
	});
});

test('a disclosure opened while the app script is held back stays open once the app starts', async ({ page }) => {
	let release = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/_app/immutable/entry/app.*.js', async (route) => {
		await held;
		await route.continue();
	});
	await page.goto('/day/2026-12-07', { waitUntil: 'commit' });
	await disclosure(page, 'Why this session').click();
	const why = page.getByText('Leader block: 5s at every step');
	await expect(why).toBeVisible();
	await expectDisclosure(disclosure(page, 'Hide why'), { name: 'Hide why', expanded: true });
	await expect(page.locator('html[data-hydrated]')).toHaveCount(0);
	release();
	await hydrated(page);
	await expect(why).toBeVisible();
	await expectDisclosure(disclosure(page, 'Hide why'), { name: 'Hide why', expanded: true });
	await disclosure(page, 'Hide why').click();
	await expectDisclosure(disclosure(page, 'Why this session'), { name: 'Why this session', expanded: false });
	await expect(why).toBeHidden();
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

test('week 4 Tuesday: the §G checkpoint, the submax then gymnastics maxes, with no hard block', async ({ page }, testInfo) => {
	await openOn(page, '2026-12-29');
	await expect(page.getByRole('heading', { level: 1, name: 'Press + checkpoint tests' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(0);
	await expect(disclosure(page, /^Submax run/)).toBeVisible();
	await expectDisclosure(disclosure(page, /^Submax run/), { name: /^Submax run/, expanded: false });
	await openDisclosure(page, /^Gymnastics maxes/);
	await expect(page.getByText('Push-ups 1 × 50')).toBeVisible();
	await expect(page.getByText(/then max push-ups · ladders: push-ups 50\/75\/100/)).toBeVisible();
	await captureEvidence(page, testInfo, 'today-week-4-checkpoint');
});

test('week 5 Tuesday: body comp comes first, fasted, as a 1-min non-hard block', async ({ page }, testInfo) => {
	await openOn(page, '2027-01-05');
	await expect(page.getByRole('heading', { level: 1, name: 'Press + Z1 run' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Hard effort' })).toHaveCount(0);
	await openDisclosure(page, /^Body comp/);
	await expect(page.getByText('Fasted, before eating: weight · tape')).toBeVisible();
	await captureEvidence(page, testInfo, 'today-week-5-body-comp');
});
