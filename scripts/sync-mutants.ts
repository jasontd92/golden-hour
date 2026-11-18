import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface Mutant {
	name: string;
	file: string;
	search: string | RegExp;
	replace: string;
}

export const propertySpec = 'src/routes/api/sync/sync.spec.ts';

export const mutants: Mutant[] = [
	{
		name: 'plain insert instead of upsert-by-id',
		file: 'src/lib/server/db/log-entries.ts',
		search: /\n\t\t\.onConflictDoUpdate\(\{[\s\S]*?\n\t\t\}\);/,
		replace: ';'
	},
	{
		name: 'no mark-synced-on-ack',
		file: 'src/lib/features/log/sync.ts',
		search: 'await store.acknowledge(records, body.data.accepted)',
		replace: 'records.length * 0'
	},
	{
		name: 'ack ignores the revision that was sent',
		file: 'src/lib/features/log/store.ts',
		search: ' && stored.record.revision === record.revision',
		replace: ''
	},
	{
		name: 'server overwrites newer revisions',
		file: 'src/lib/server/db/log-entries.ts',
		search: ',\n\t\t\tsetWhere: sql`excluded.revision > ${logEntries.revision}`',
		replace: ''
	}
];

const runProperty = () =>
	spawnSync('pnpm', ['-s', 'vitest', '--run', propertySpec, '-t', 'whatever the network does'], { encoding: 'utf8' });

const firstFailure = (output: string) =>
	output.split('\n').filter((line) => /Counterexample|AssertionError|Expected|Received|Error:/.test(line)).slice(0, 6).join('\n');

function changedLines(original: string, file: string): { count: number; diff: string } {
	const copy = path.join(mkdtempSync(path.join(tmpdir(), 'sync-mutant-')), path.basename(file));
	writeFileSync(copy, original);
	const diff = spawnSync('git', ['diff', '--no-index', '--unified=0', '--', copy, file], { encoding: 'utf8' }).stdout;
	const count = diff.split('\n').filter((line) => /^[-+](?![-+]{2} )/.test(line)).length;
	return { count, diff: diff.split('\n').filter((line) => /^[-+](?![-+]{2} )/.test(line)).join('\n') };
}

if (import.meta.main) {
	let ok = true;
	const control = runProperty();
	console.log(`positive control (unmutated): exit ${control.status}`);
	ok &&= control.status === 0;
	for (const mutant of mutants) {
		const original = readFileSync(mutant.file, 'utf8');
		writeFileSync(mutant.file, original.replace(mutant.search, mutant.replace));
		try {
			const changed = changedLines(original, mutant.file);
			const result = runProperty();
			const killed = changed.count > 0 && result.status !== 0;
			ok &&= killed;
			console.log(`\n${killed ? 'KILLED' : 'SURVIVED'}: ${mutant.name}\n  ${mutant.file}: ${changed.count} changed lines\n  property exit ${result.status}`);
			console.log(changed.diff.replace(/^/gm, '  ~ '));
			console.log(firstFailure(result.stdout + result.stderr).replace(/^/gm, '  | '));
		} finally {
			writeFileSync(mutant.file, original);
		}
	}
	process.exit(ok ? 0 : 1);
}
