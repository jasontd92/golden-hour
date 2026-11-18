import { defineConfig, devices } from '@playwright/test';
import { e2eServerEnv } from './e2e/sync-env.ts';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	outputDir: 'test-results',
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['list'], ['github']] : 'list',
	webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', port: 4173, env: e2eServerEnv },
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{ name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
		{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
	]
});
