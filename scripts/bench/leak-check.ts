import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { listRepoFiles, report } from '../repo-files.ts';
import { catalog, type BugClass } from './catalog.ts';

export const verifierFacing = ['.claude/**', 'scripts/bench/verifier-prompt.ts'];

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

export function leaks(source: string, text: string, classes: readonly BugClass[] = catalog): string[] {
	const raw = text.toLowerCase();
	const flat = words(text);
	return classes.flatMap((bugClass) => {
		const found: string[] = [];
		if (new RegExp(`(^|[^a-z0-9-])${bugClass.id}($|[^a-z0-9-])`).test(raw)) found.push(`class id '${bugClass.id}'`);
		if (flat.includes(words(bugClass.description))) found.push(`the description of '${bugClass.id}'`);
		return found.map((what) => `${source}: mentions ${what}. Verifier prompts must stay blind to the bug catalog, or recall measures the prompt, not the verifier.`);
	});
}

export function repoLeaks(files: string[], read: (file: string) => string): string[] {
	return files
		.filter((file) => verifierFacing.some((glob) => path.posix.matchesGlob(file, glob)))
		.flatMap((file) => leaks(file, read(file)));
}

export function filesUnder(target: string): string[] {
	const stats = statSync(target, { throwIfNoEntry: false });
	if (!stats) return [];
	if (stats.isFile()) return [target];
	if (!stats.isDirectory()) return [];
	return readdirSync(target).flatMap((entry) => filesUnder(path.join(target, entry)));
}

export function pathLeaks(targets: string[]): string[] {
	return targets.flatMap(filesUnder).flatMap((file) => leaks(file, readFileSync(file, 'utf8')));
}

if (import.meta.main) {
	const extra = process.argv.slice(2);
	report([...repoLeaks(listRepoFiles(), (file) => readFileSync(file, 'utf8')), ...pathLeaks(extra)], 'leak-check: ok');
}
