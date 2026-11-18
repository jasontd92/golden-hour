import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { mutate } = JSON.parse(readFileSync(path.join(root, 'stryker.config.json'), 'utf8')) as { mutate: string[] };

const matchesAny = (file: string, globs: string[]) => globs.some((glob) => path.posix.matchesGlob(file, glob));
const included = mutate.filter((glob) => !glob.startsWith('!'));
const excluded = mutate.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1));

export function mutatedFiles(files: string[]): string[] {
	return files.filter((file) => matchesAny(file, included) && !matchesAny(file, excluded));
}

if (import.meta.main) {
	const changed = readFileSync(0, 'utf8').split('\n').filter(Boolean);
	console.log(mutatedFiles(changed).join(','));
}
