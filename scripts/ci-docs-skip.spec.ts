import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { markdownAllowlist } from './check-md.ts';

const read = (file: string) => readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8');

const { on } = parse(read('.github/workflows/ci.yml')) as {
	on: Record<'pull_request' | 'push', { 'paths-ignore': string[] }>;
};
const { ignoreCommand } = JSON.parse(read('vercel.json')) as { ignoreCommand: string };

const ciDocsPaths = on.pull_request['paths-ignore'];
const vercelDocsPaths = [...ignoreCommand.matchAll(/':\^([^']+)'/g)].map(([, pathspec]) => pathspec);

it('pushes to main and pull requests skip CI for the same docs paths', () => {
	expect(on.push['paths-ignore']).toEqual(ciDocsPaths);
});

it('CI skips exactly the docs paths that Vercel skips', () => {
	expect(ciDocsPaths.map((glob) => glob.replace(/\/\*\*$/, '')).sort()).toEqual([...vercelDocsPaths].sort());
});

it('CI skips only paths where markdown is allowed, so a stray markdown file still fails the policy job', () => {
	expect(ciDocsPaths.filter((glob) => !markdownAllowlist.includes(glob))).toEqual([]);
});
