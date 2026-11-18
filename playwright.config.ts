import { defineConfig, devices } from '@playwright/test';
import { e2eServerEnv } from './e2e/sync-env.ts';

const desktopSpecs = '**/*.desktop.e2e.ts';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	outputDir: 'test-results',
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['list'], ['github']] : 'list',
	webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', port: 4173, env: e2eServerEnv },
	use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
	projects: [
		{ name: 'mobile-webkit', testIgnore: desktopSpecs, use: { ...devices['iPhone 15'] } },
		{ name: 'mobile-chromium', testIgnore: desktopSpecs, use: { ...devices['Pixel 7'] } },
		{
			name: 'desktop-chromium',
			testMatch: desktopSpecs,
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		}
	]
});
