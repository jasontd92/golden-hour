import { describe, expect, it } from 'vitest';
import { openDb } from './client.ts';
import { normalizeDbUrl, urlScheme } from './url.ts';

const host = 'golden-hour-secret.aws-us-west-2.turso.io';

describe('normalizeDbUrl', () => {
	it.each([
		['libsql', `libsql://${host}`, `libsql://${host}`],
		['https', `https://${host}`, `https://${host}`],
		['surrounding whitespace', `  libsql://${host}\n`, `libsql://${host}`],
		['double quotes', `"libsql://${host}"`, `libsql://${host}`],
		['single quotes', `'libsql://${host}'`, `libsql://${host}`],
		['quotes inside whitespace', ` "libsql://${host}" `, `libsql://${host}`],
		['a query string', `libsql://${host}?tls=1`, `libsql://${host}?tls=1`],
		['empty', '', undefined],
		['only quotes', '""', undefined],
		['unset', undefined, undefined]
	])('%s', (_, raw, expected) => {
		expect(normalizeDbUrl(raw)).toBe(expected);
	});
});

describe('urlScheme', () => {
	it.each([
		[`libsql://${host}`, 'libsql'],
		[`LIBSQL://${host}`, 'libsql'],
		[`  "libsql://${host}"\n`, 'libsql'],
		[`https://${host}`, 'https'],
		[`wss://${host}`, 'wss'],
		['file:local.db', 'file'],
		[':memory:', 'memory'],
		[`postgres://user:pass@${host}/db`, 'postgres'],
		[`"libsql://${host}`, 'quoted'],
		[host, 'none'],
		[`TURSO_DATABASE_URL=libsql://${host}`, 'none'],
		[`${host.replace(/\d/g, '')}:443`, 'other'],
		[`turso://${host}`, 'other'],
		['', 'missing'],
		[undefined, 'missing']
	] as const)('%j is %s, never the host', (raw, expected) => {
		const scheme = urlScheme(raw);
		expect(scheme).toBe(expected);
		expect(scheme).not.toContain('turso.io');
	});
});

describe('openDb', () => {
	it.each([`libsql://${host}`, `https://${host}`, `libsql://${host}?tls=1`])('builds a web client for %s without connecting', async (url) => {
		await expect(openDb(url, 'token')).resolves.toBeDefined();
	});

	it.each([
		[`postgres://${host}`, 'URL_SCHEME_NOT_SUPPORTED'],
		[`"libsql://${host}"`, 'URL_INVALID']
	])('rejects %s with %s, which normalizeDbUrl exists to prevent', async (url, code) => {
		await expect(openDb(url)).rejects.toMatchObject({ code });
		if (code === 'URL_INVALID') await expect(openDb(normalizeDbUrl(url)!)).resolves.toBeDefined();
	});
});
