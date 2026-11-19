import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { createE2eDatabase } from './sync-env.ts';

// why: POSIX file locks never conflict within one process, so the writer must be a separate process, as the preview server is
const holdWriteLock = `
const db = new (require('node:sqlite').DatabaseSync)(process.argv[1]);
db.exec('BEGIN EXCLUSIVE; INSERT INTO t VALUES (1);');
process.stdout.write('locked');
process.stdin.on('end', () => { db.exec('COMMIT'); db.close(); }).resume();
`;

describe('the e2e server database', () => {
	it('is created in WAL mode, which every later connection inherits', async () => {
		const url = createE2eDatabase(mkdtempSync(path.join(tmpdir(), 'golden-hour-e2e-spec-')));
		expect(path.basename(fileURLToPath(url))).toBe('log.db');
		const client = createClient({ url });
		try {
			const { rows } = await client.execute('PRAGMA journal_mode');
			expect(rows[0]?.journal_mode).toBe('wal');
		} finally {
			client.close();
		}
	});

	it('lets a reader in another process read while the writer holds its lock', async () => {
		const url = createE2eDatabase(mkdtempSync(path.join(tmpdir(), 'golden-hour-e2e-spec-')));
		const file = fileURLToPath(url);
		const setup = new DatabaseSync(file);
		setup.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
		setup.close();
		const writer = spawn(process.execPath, ['-e', holdWriteLock, file], { stdio: ['pipe', 'pipe', 'inherit'] });
		const reader = createClient({ url });
		try {
			await once(writer.stdout, 'data');
			const { rows } = await reader.execute('SELECT count(*) AS n FROM t');
			expect(rows[0]?.n).toBe(0);
		} finally {
			reader.close();
			writer.stdin.end();
			await once(writer, 'exit');
		}
	});
});
