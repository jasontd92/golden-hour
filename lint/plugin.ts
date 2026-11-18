import type { ESLint } from 'eslint';
import { layerBoundaries } from './rules/layer-boundaries.ts';
import { noProseComments } from './rules/no-prose-comments.ts';

export const goldenHour: ESLint.Plugin = {
	meta: { name: 'golden-hour' },
	rules: {
		'layer-boundaries': layerBoundaries,
		'no-prose-comments': noProseComments
	}
};
