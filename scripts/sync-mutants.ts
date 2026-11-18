import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface Mutant {
	name: string;
	file: string;
	search: string | RegExp;
	replace: string;
	changedLines: number;
}

export const propertySpec = 'src/routes/api/sync/sync.spec.ts';

export const assertionTags = ['client', 'duplicate', 'server', 'tombstone', 'drain'] as const;

export const mutants: Mutant[] = [
	{
		name: 'plain insert instead of upsert-by-id',
		file: 'src/lib/server/db/log-entries.ts',
		search: /\n\t\t\.onConflictDoUpdate\(\{[\s\S]*?\n\t\t\}\);/,
		replace: ';',
		changedLines: 7
	},
	{
		name: 'no mark-synced-on-ack',
		file: 'src/lib/features/log/sync.ts',
		search: 'await store.acknowledge(records, body.data.accepted)',
		replace: 'records.length * 0',
		changedLines: 2
	},
	{
		name: 'ack ignores the revision that was sent',
		file: 'src/lib/features/log/store.ts',
		search: ' && stored.record.revision === record.revision',
		replace: '',
		changedLines: 2
	},
	{
		name: 'server overwrites newer revisions',
		file: 'src/lib/server/db/log-entries.ts',
		search: ',\n\t\t\tsetWhere: sql`excluded.revision > ${logEntries.revision}`',
		replace: '',
		changedLines: 3
	},
	{
		name: 'ack marks every sent record, ignoring the accepted ids',
		file: 'src/lib/features/log/store.ts',
		search: '\n\t\t\t\tif (!acceptedIds.has(record.id)) continue;',
		replace: '',
		changedLines: 1
	},
	{
		name: 'sync returns after one batch',
		file: 'src/lib/features/log/sync.ts',
		search: 'count += marked;',
		replace: "return { kind: 'synced', count: count + marked };",
		changedLines: 2
	},
	{
		name: 'store forgets the outbox on reload',
		file: 'src/lib/features/log/store.ts',
		search: 'openDB<LogDb>(name, 1,',
		replace: 'openDB<LogDb>(`${name}-${Math.random()}`, 1,',
		changedLines: 2
	},
	{
		name: 'server assigns its own ids, so a resent record is stored again',
		file: 'src/lib/server/db/log-entries.ts',
		search: '\t\t.values(records.map((record) => toRow(record, receivedAt)))',
		replace: "\t\t.values(records.map((record) => toRow({ ...record, id: crypto.randomUUID().replace(/^(.{14})./, '$17') }, receivedAt)))",
		changedLines: 2
	}
];

const report = path.join(mkdtempSync(path.join(tmpdir(), 'sync-proof-')), 'vitest.json');

function runProperty(): Verdict {
	const result = spawnSync(
		'pnpm',
		['-s', 'vitest', '--run', propertySpec, '-t', 'hold-the-line A', '--reporter=json', `--outputFile=${report}`],
		{ encoding: 'utf8' }
	);
	if (result.status === 0) return { kind: 'passed' };
	let failures: Failure[];
	try {
		const parsed = JSON.parse(readFileSync(report, 'utf8')) as VitestReport;
		failures = parsed.testResults.flatMap((file) =>
			file.assertionResults.filter((test) => test.status === 'failed').map((test) => ({ test: test.title, message: test.failureMessages[0] ?? '' }))
		);
	} catch {
		return { kind: 'crashed', line: `exit ${result.status}, no report: ${result.stderr.split('\n')[0]}` };
	}
	return verdict(failures, result.status);
}

interface VitestReport {
	testResults: { assertionResults: { title: string; status: string; failureMessages: string[] }[] }[];
}

export interface Failure {
	test: string;
	message: string;
}

export type Verdict = { kind: 'passed' } | { kind: 'assertion'; tags: string[]; line: string } | { kind: 'crashed'; line: string };

const testLabel = (title: string) =>
	title.startsWith('positive control') ? 'scripted history' : title.includes('batch limit') ? 'batch-limit drain' : 'property';

const tagged = /AssertionError: \[([a-z]+)\][^\n]*/;

export function verdict(failures: Failure[], status: number | null): Verdict {
	if (failures.length === 0) return { kind: 'crashed', line: `exit ${status} with no failed test (an unhandled error?)` };
	const tags: string[] = [];
	for (const { test, message } of failures) {
		const match = message.match(tagged);
		const wrapped = message.startsWith('AssertionError') || message.startsWith('Error: Property failed');
		if (!match || !wrapped || !(assertionTags as readonly string[]).includes(match[1]!)) {
			return { kind: 'crashed', line: `${test}: ${message.split('\n')[0]}` };
		}
		tags.push(`[${match[1]}] in ${testLabel(test)}`);
	}
	return { kind: 'assertion', tags, line: failures[0]!.message.match(tagged)![0] };
}

function changedLines(original: string, file: string): { count: number; diff: string } {
	const copy = path.join(mkdtempSync(path.join(tmpdir(), 'sync-mutant-')), path.basename(file));
	writeFileSync(copy, original);
	const diff = spawnSync('git', ['diff', '--no-index', '--unified=0', '--', copy, file], { encoding: 'utf8' }).stdout;
	const lines = diff.split('\n').filter((line) => /^[-+](?![-+]{2} )/.test(line));
	return { count: lines.length, diff: lines.join('\n') };
}

if (import.meta.main) {
	let ok = true;
	const control = runProperty();
	console.log(`positive control (unmutated): ${control.kind}${control.kind === 'passed' ? '' : ` | ${control.line}`}`);
	ok &&= control.kind === 'passed';
	for (const mutant of mutants) {
		const original = readFileSync(mutant.file, 'utf8');
		writeFileSync(mutant.file, original.replace(mutant.search, mutant.replace));
		try {
			const changed = changedLines(original, mutant.file);
			const linesMatch = changed.count === mutant.changedLines;
			const outcome = runProperty();
			const killed = linesMatch && outcome.kind === 'assertion';
			ok &&= killed;
			const reason = outcome.kind === 'assertion' ? `by ${outcome.tags.join(', ')}` : outcome.kind;
			console.log(`\n${killed ? 'KILLED' : 'NOT KILLED'} ${reason}: ${mutant.name}`);
			console.log(`  ${mutant.file}: ${changed.count} changed lines (expected ${mutant.changedLines}${linesMatch ? '' : ', MISMATCH'})`);
			console.log(changed.diff.replace(/^/gm, '  ~ '));
			if (outcome.kind !== 'passed') console.log(`  | ${outcome.line}`);
		} finally {
			writeFileSync(mutant.file, original);
		}
	}
	process.exit(ok ? 0 : 1);
}
