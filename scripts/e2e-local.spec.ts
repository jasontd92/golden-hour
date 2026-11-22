import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ciPlaywrightImage, dockerArgs, forwardedArgs, pinnedPnpm } from './e2e-local.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('e2e:local', () => {
	it('runs the Playwright image CI uses, at the installed Playwright version', () => {
		const image = ciPlaywrightImage(read('.github/workflows/ci.yml'));
		const installed = (createRequire(import.meta.url)('@playwright/test/package.json') as { version: string }).version;
		expect(image).toBe(`mcr.microsoft.com/playwright:v${installed}-noble`);
	});

	it('installs the pinned pnpm inside the container, without touching host node_modules', () => {
		const args = dockerArgs('img', pinnedPnpm(read('package.json')), '/repo', false);
		expect(args[args.indexOf('-c') + 1]).toMatch(/npm install -g --silent pnpm@\d+\.\d+\.\d+ && pnpm install --frozen-lockfile && pnpm test:e2e "\$@"$/);
		expect(args).toContain('/work/node_modules');
		expect(args).toEqual(expect.arrayContaining(['CI=true', '/repo:/work', 'img']));
	});

	it('passes Playwright arguments through as positional parameters, never into the shell string', () => {
		const args = dockerArgs('img', 'pnpm@1.2.3', '/repo', false, forwardedArgs(['--', 'e2e/log.e2e.ts', '--repeat-each=5', '$(touch x)']));
		const script = args.indexOf('-c') + 1;
		expect(args[script]).not.toContain('repeat-each');
		expect(args.slice(script + 1)).toEqual(['sh', 'e2e/log.e2e.ts', '--repeat-each=5', '$(touch x)']);
		expect(forwardedArgs([])).toEqual([]);
	});

	it('rejects a workflow without an e2e container and an unpinned pnpm', () => {
		expect(() => ciPlaywrightImage('jobs: { e2e: { runs-on: ubuntu-latest } }')).toThrow(/container.image/);
		expect(() => pinnedPnpm('{"packageManager":"pnpm@12"}')).toThrow(/pin/);
	});
});
