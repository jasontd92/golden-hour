import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import { goldenHour } from './lint/plugin.ts';

const effectsFiles = ['src/lib/features/*/effects.ts', 'src/lib/features/*/effects.svelte.ts'];
const timerFix = "Timers mask ordering bugs. Move scheduling into the feature's effects.ts.";
const timers = ['setTimeout', 'requestAnimationFrame', 'requestIdleCallback'];
const e2eTestFix = "Import test from e2e/test.ts: its page waits for hydration, so a tap is never lost.";
const effectFix = "derive with $derived or move side effects to the feature's effects.svelte.ts";

export default defineConfig(
	includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	{
		linterOptions: { reportUnusedDisableDirectives: 'error' },
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		plugins: { 'golden-hour': goldenHour },
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
			'golden-hour/layer-boundaries': 'error',
			'golden-hour/no-prose-comments': 'error'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: { extraFileExtensions: ['.svelte'], parser: ts.parser }
		}
	},
	{
		files: ['src/**'],
		ignores: ['src/lib/ui/**', ...effectsFiles],
		rules: {
			'no-restricted-syntax': [
				'error',
				{ selector: "CallExpression[callee.name='$effect']", message: effectFix },
				{ selector: "CallExpression[callee.object.name='$effect']", message: effectFix }
			]
		}
	},
	{
		files: ['src/lib/features/**'],
		ignores: effectsFiles,
		rules: {
			'no-restricted-globals': ['error', ...timers.map((name) => ({ name, message: timerFix }))],
			'no-restricted-properties': [
				'error',
				...['window', 'globalThis', 'self'].flatMap((object) =>
					timers.map((property) => ({ object, property, message: timerFix }))
				)
			]
		}
	},
	{
		files: ['e2e/**'],
		ignores: ['e2e/test.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{ paths: [{ name: '@playwright/test', importNames: ['test'], message: e2eTestFix }] }
			]
		}
	}
);
