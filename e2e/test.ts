import { test as base, expect, type Locator, type Page, type Response } from '@playwright/test';

export { expect };

// why: a tap on prerendered HTML before hydration has no handler and is silently lost
export async function hydrated(page: Page): Promise<void> {
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function untilHydrated(page: Page, response: Response | null): Promise<Response | null> {
	if (response === null || response.ok()) await hydrated(page);
	return response;
}

// why: Playwright maps summary to no role, so getByRole cannot find it; first summary of a details is what HTML exposes as its disclosure control
export const disclosure = (scope: Page | Locator, name: string | RegExp) =>
	scope.locator('details > summary:first-of-type').filter({ hasText: name });

const axProbe = 'data-ax-probe';

async function chromiumAxNode(summary: Locator): Promise<{ role: string; name: string; expanded: unknown }> {
	const page = summary.page();
	const cdp = await page.context().newCDPSession(page);
	try {
		await summary.evaluate((el, attr) => el.setAttribute(attr, ''), axProbe);
		const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
		const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[${axProbe}]` });
		const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
		const [node] = nodes;
		return {
			role: String(node?.role?.value ?? ''),
			name: String(node?.name?.value ?? ''),
			expanded: node?.properties?.find((p) => p.name === 'expanded')?.value.value
		};
	} finally {
		await summary.evaluate((el, attr) => el.removeAttribute(attr), axProbe);
		await cdp.detach();
	}
}

export async function expectDisclosure(summary: Locator, { name, expanded }: { name: string | RegExp; expanded: boolean }): Promise<void> {
	await expect(summary).toHaveAccessibleName(name);
	await expect(summary.locator('xpath=..')).toHaveJSProperty('open', expanded);
	// why: only Chromium lets a test read the browser's own accessibility tree; WebKit's is checked by hand with VoiceOver
	if (summary.page().context().browser()?.browserType().name() !== 'chromium') return;
	await expect
		.poll(() => chromiumAxNode(summary))
		.toEqual({ role: expect.stringMatching(/^DisclosureTriangle/), name: typeof name === 'string' ? name : expect.stringMatching(name), expanded });
}

export async function openDisclosure(scope: Page | Locator, name: string | RegExp): Promise<Locator> {
	const summary = disclosure(scope, name);
	await expectDisclosure(summary, { name, expanded: false });
	await summary.click();
	await expectDisclosure(summary, { name, expanded: true });
	return summary;
}

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
