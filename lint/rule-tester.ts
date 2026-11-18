import { RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

RuleTester.describe = describe;
RuleTester.it = (text: string, method: () => void) => it(text, () => expect(method).not.toThrow());
RuleTester.itOnly = (text: string, method: () => void) => it.only(text, () => expect(method).not.toThrow());

export const tsTester = new RuleTester({ languageOptions: { parser: ts.parser } });

export const svelteTester = new RuleTester({
	languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
});

export const at = (relative: string) => `${process.cwd()}/${relative}`;
