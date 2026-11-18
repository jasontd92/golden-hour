import path from 'node:path';

export type Layer =
	| { kind: 'domain' }
	| { kind: 'feature'; name: string }
	| { kind: 'ui' }
	| { kind: 'server' }
	| { kind: 'routes' }
	| { kind: 'other' };

export function layerOf(root: string, file: string): Layer {
	const parts = path.relative(root, file).split(path.sep);
	if (parts[0] === 'src' && parts[1] === 'routes') return { kind: 'routes' };
	if (parts[0] !== 'src' || parts[1] !== 'lib') return { kind: 'other' };
	const [, , dir, name] = parts;
	if (dir === 'domain') return { kind: 'domain' };
	if (dir === 'ui') return { kind: 'ui' };
	if (dir === 'server') return { kind: 'server' };
	if (dir === 'features' && name && parts.length > 4) return { kind: 'feature', name };
	return { kind: 'other' };
}

export function isServerOnlyFile(root: string, file: string): boolean {
	return layerOf(root, file).kind === 'server' || /(^|[.+])server\.[jt]s$/.test(path.basename(file));
}

const libAlias = /^[#$]lib(\/|$)/;

export function resolveSpecifier(root: string, file: string, specifier: string): string | undefined {
	if (specifier.startsWith('.')) return path.resolve(path.dirname(file), specifier);
	if (libAlias.test(specifier)) return path.join(root, 'src/lib', specifier.replace(libAlias, ''));
	return undefined;
}
