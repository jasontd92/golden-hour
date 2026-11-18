import type { Page } from '@playwright/test';

export async function openOn(page: Page, date: string, path = '/'): Promise<void> {
	await page.clock.setFixedTime(new Date(`${date}T09:00:00`));
	await page.goto(path);
}
