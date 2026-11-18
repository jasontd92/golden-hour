import { expect, test } from './test.ts';
import { openOn } from './clock.ts';

const screens = ['/', '/week', '/day/2026-12-08', '/progress', '/progress/lifts/back-squat'];

for (const path of screens) {
	test(`the end of ${path} clears the tab bar`, async ({ page }) => {
		await openOn(page, '2026-12-07', path);
		await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		const end = await page.evaluate(() => {
			const bar = document.querySelector('nav[aria-label="Main"]')!;
			const shown = [...document.body.querySelectorAll<HTMLElement>('*')].filter((element) => {
				if (bar.contains(element) || element.checkVisibility() === false) return false;
				const box = element.getBoundingClientRect();
				return box.height > 0 && (element.childElementCount === 0 || element.matches('a, button, input, select, textarea'));
			});
			const last = shown.toSorted((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]!;
			const box = last.getBoundingClientRect();
			const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
			return { label: last.textContent?.trim(), hit: last.contains(hit), bottom: box.bottom, barTop: bar.getBoundingClientRect().top };
		});
		expect(end.hit, `"${end.label}" is covered at its centre`).toBe(true);
		expect(end.bottom, `"${end.label}" reaches under the tab bar`).toBeLessThanOrEqual(end.barTop);
	});
}
