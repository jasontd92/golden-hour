export function failureReason(error: unknown): string {
	const name = error instanceof Error ? error.name : typeof error;
	const code = (error as { code?: unknown } | null)?.code;
	return typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? `${name} ${code}` : name;
}
