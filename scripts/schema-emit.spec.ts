import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { emittedSchemas, renderSchema, schemasDir } from './schema-emit.ts';

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, validateFormats: false });
const validator = (name: string) => ajv.getSchema(`golden-hour/${name}.json`) ?? ajv.compile(readJson(path.join(schemasDir, `${name}.json`)) as object);

describe('schemas/*.json', () => {
	it.each(Object.entries(emittedSchemas))('%s.json is current (run pnpm schema:emit)', (name, schema) => {
		expect(readFileSync(path.join(schemasDir, `${name}.json`), 'utf8')).toBe(renderSchema(name, schema));
	});

	it('validate every plan week without TypeScript', () => {
		const validate = validator('plan-week');
		for (const file of readdirSync('plan').filter((name) => name.startsWith('week-'))) {
			expect(validate(readJson(path.join('plan', file))), `${file} ${JSON.stringify(validate.errors)}`).toBe(true);
		}
		const [monday] = readJson('plan/week-01.json') as unknown[];
		expect(validator('plan-session')(monday)).toBe(true);
		expect(validator('plan-session')({ ...(monday as object), week: 18 })).toBe(false);
		expect(validator('plan-session')({ ...(monday as object), blocks: [{ kind: 'metcon' }] })).toBe(false);
	});

	it('validate every normalized record', () => {
		const workouts = readJson('data/normalized/workouts.json') as unknown[];
		const lifts = Object.values(readJson('data/normalized/lifts.json') as Record<string, unknown[]>).flat();
		const results = readFileSync('data/normalized/results.jsonl', 'utf8').split('\n').filter(Boolean);
		expect(workouts.every((w) => validator('workout')(w))).toBe(true);
		expect(lifts.every((l) => validator('lift-evidence')(l))).toBe(true);
		expect(results.every((line) => validator('result')(JSON.parse(line)))).toBe(true);
	});
});
