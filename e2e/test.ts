import { test as base, type Locator, type Page, type Response } from '@playwright/test';

export { expect } from '@playwright/test';

// why: a tap on prerendered HTML before hydration has no handler and is silently lost
export async function hydrated(page: Page): Promise<void> {
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function untilHydrated(page: Page, response: Response | null): Promise<Response | null> {
	if (response === null || response.ok()) await hydrated(page);
	return response;
}

export const disclosure = (scope: Page | Locator, name: string | RegExp) => scope.locator('summary').filter({ hasText: name });

export const test = base.extend({
	page: async ({ page, javaScriptEnabled }, use) => {
		const goto = page.goto.bind(page);
		const reload = page.reload.bind(page);
		page.goto = async (url, options) => {
			const response = await goto(url, options);
			return javaScriptEnabled === false || options?.waitUntil === 'commit' ? response : untilHydrated(page, response);
		};
		page.reload = async (...args) => untilHydrated(page, await reload(...args));
		await use(page);
	}
});
