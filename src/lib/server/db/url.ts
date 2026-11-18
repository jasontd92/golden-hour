const reportedSchemes = ['libsql', 'https', 'http', 'wss', 'ws', 'file', 'postgres', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis'] as const;

export type UrlScheme = (typeof reportedSchemes)[number] | 'memory' | 'missing' | 'quoted' | 'none' | 'other';

const surroundingQuotes = /^(["'`])(.*)\1$/s;

export function normalizeDbUrl(raw: string | undefined): string | undefined {
	const trimmed = raw?.trim() ?? '';
	const unquoted = trimmed.replace(surroundingQuotes, '$2').trim();
	return unquoted === '' ? undefined : unquoted;
}

export function urlScheme(raw: string | undefined): UrlScheme {
	const url = normalizeDbUrl(raw);
	if (url === undefined) return 'missing';
	if (url === ':memory:') return 'memory';
	if (/^["'`]/.test(url)) return 'quoted';
	const token = url.match(/^([A-Za-z][A-Za-z0-9.+-]*):/)?.[1]?.toLowerCase();
	if (token === undefined) return 'none';
	return reportedSchemes.find((scheme) => scheme === token) ?? 'other';
}
