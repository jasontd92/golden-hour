import { test as base, type Page, type Response } from '@playwright/test';

export { expect } from '@playwright/test';

// why: a tap on prerendered HTML before hydration has no handler and is silently lost
export async function hydrated(page: Page): Promise<void> {
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function untilHydrated(page: Page, response: Response | null): Promise<Response | null> {
	if (response === null || response.ok()) await hydrated(page);
	return response;
}

export const test = base.extend({
	page: async ({ page }, use) => {
		const goto = page.goto.bind(page);
		const reload = page.reload.bind(page);
		page.goto = async (...args) => untilHydrated(page, await goto(...args));
		page.reload = async (...args) => untilHydrated(page, await reload(...args));
		await use(page);
	}
});
