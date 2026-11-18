import { describe, expect, it } from 'vitest';
import { featureFlag } from './flags.ts';

const yaml = '- name: today\n  route: /\n  e2e: e2e/today.e2e.ts\n  flags:\n    start: true\n';

describe('featureFlag', () => {
	it('reads a flag from features.yaml, off unless exactly true', () => {
		expect(featureFlag('today', 'start', yaml)).toBe(true);
		expect(featureFlag('today', 'other', yaml)).toBe(false);
		expect(featureFlag('week', 'start', yaml)).toBe(false);
		expect(featureFlag('today', 'start', 'name: today')).toBe(false);
	});

});
