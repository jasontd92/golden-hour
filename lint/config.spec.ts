import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function messages(file: string, code: string) {
	const [result] = await eslint.lintText(code, { filePath: file });
	return (result?.messages ?? []).map((m) => `${m.ruleId}: ${m.message}`);
}

const coldStartMs = 30_000;

// why: the first lintText loads the config, svelte parser and TS program; pay that once here, not in whichever test runs first
beforeAll(async () => {
	await Promise.all([
		messages('src/lib/features/today/Warm.svelte', '<script lang="ts">\n\tlet a = 1;\n</script>\n\n<p>{a}</p>\n'),
		messages('src/lib/domain/warm.ts', 'export const a = 1;\n')
	]);
}, coldStartMs);

const effect = '<script lang="ts">\n\tlet a = $state(0);\n\t$effect(() => {\n\t\tdocument.title = String(a);\n\t});\n</script>\n\n<p>{a}</p>\n';
const effectRule = "no-restricted-syntax: derive with $derived or move side effects to the feature's effects.svelte.ts";

describe('$effect placement', () => {
	it('fails in a feature component', async () => {
		expect(await messages('src/lib/features/today/Today.svelte', effect)).toContain(effectRule);
	});
	it('fails in a route', async () => {
		expect(await messages('src/routes/+page.svelte', effect)).toContain(effectRule);
	});
	it('passes in a ui primitive', async () => {
		expect(await messages('src/lib/ui/Disclosure.svelte', effect)).toEqual([]);
	});
	it("passes in a feature's effects.svelte.ts", async () => {
		const code = 'export function track(read: () => number) {\n\t$effect(() => {\n\t\tread();\n\t});\n}\n';
		expect(await messages('src/lib/features/today/effects.svelte.ts', code)).toEqual([]);
	});
});

describe('timers in features', () => {
	const timerRule = /^no-restricted-(globals|properties): .*Timers mask ordering bugs/;
	it.each(['setTimeout(() => {}, 1);', 'requestAnimationFrame(() => {});', 'window.requestIdleCallback(() => {});'])(
		'fails for %s outside effects.ts',
		async (code) => {
			const found = await messages('src/lib/features/log/rest.ts', `export const start = () => ${code}\n`);
			expect(found.some((m) => timerRule.test(m))).toBe(true);
		}
	);
	it('passes in effects.ts', async () => {
		expect(await messages('src/lib/features/log/effects.ts', 'export const start = () => setTimeout(() => {}, 1);\n')).toEqual([]);
	});
});

describe('boundaries through the real config', () => {
	it('fails when domain imports a feature', async () => {
		const found = await messages('src/lib/domain/plan.ts', "import { x } from '#lib/features/today/model.ts';\nexport const y = x;\n");
		expect(found.some((m) => m.startsWith('golden-hour/layer-boundaries: src/lib/domain is pure TS'))).toBe(true);
	});
});
