import type { Rule } from 'eslint';
import { isServerOnlyFile, layerOf, resolveSpecifier } from '../layers.ts';

const frameworkPackages = /^(svelte|@sveltejs\/kit|[$#]app)(\/|$)/;
const domainPackages = /^zod(\/|$)/;
const specFile = /\.spec\.ts$/;

export const layerBoundaries: Rule.RuleModule = {
	meta: {
		type: 'problem',
		schema: [],
		messages: {
			domainImport:
				'src/lib/domain is pure TS and must not import from src/lib/{{target}}. Move the shared logic into src/lib/domain, or have {{target}} import domain instead.',
			domainFramework:
				"src/lib/domain must not depend on '{{specifier}}'. Keep domain framework-free; do this in a feature or src/lib/ui.",
			domainPackage:
				"src/lib/domain may import only src/lib/domain and zod, not '{{specifier}}'. Keep domain pure: take the value as an argument, or do the I/O in a feature, script or src/lib/server.",
			domainOutside:
				"src/lib/domain may import only src/lib/domain and zod; '{{specifier}}' resolves outside it. Pass the data in as an argument, or move the code into src/lib/domain.",
			crossFeature:
				"Feature '{{from}}' must not import feature '{{to}}'. Move what both need into src/lib/domain or src/lib/ui, or compose them in a route.",
			serverFromClient:
				'src/lib/server is server-only. Import it only from src/lib/server, *.server.ts, +server.ts or a route spec, and pass data to the client through a load function.'
		}
	},
	create(context) {
		const root = context.cwd;
		const file = context.filename;
		const from = layerOf(root, file);
		const serverOnly = isServerOnlyFile(root, file) || (from.kind === 'routes' && specFile.test(file));
		const pureDomain = from.kind === 'domain' && !specFile.test(file);

		function check(node: Rule.Node, specifier: unknown) {
			if (typeof specifier !== 'string') return;
			if (from.kind === 'domain' && frameworkPackages.test(specifier)) {
				context.report({ node, messageId: 'domainFramework', data: { specifier } });
				return;
			}
			const resolved = resolveSpecifier(root, file, specifier);
			if (!resolved) {
				if (pureDomain && !domainPackages.test(specifier)) {
					context.report({ node, messageId: 'domainPackage', data: { specifier } });
				}
				return;
			}
			const to = layerOf(root, resolved);
			if (from.kind === 'domain' && to.kind !== 'domain' && to.kind !== 'other') {
				const target = to.kind === 'feature' ? 'features' : to.kind;
				context.report({ node, messageId: 'domainImport', data: { target } });
				return;
			}
			if (pureDomain && to.kind === 'other') {
				context.report({ node, messageId: 'domainOutside', data: { specifier } });
				return;
			}
			if (from.kind === 'feature' && to.kind === 'feature' && from.name !== to.name) {
				context.report({ node, messageId: 'crossFeature', data: { from: from.name, to: to.name } });
				return;
			}
			if (to.kind === 'server' && !serverOnly) {
				context.report({ node, messageId: 'serverFromClient' });
			}
		}

		return {
			ImportDeclaration: (node) => check(node, node.source.value),
			ExportNamedDeclaration: (node) => check(node, node.source?.value),
			ExportAllDeclaration: (node) => check(node, node.source.value),
			ImportExpression: (node) => {
				if (node.source.type === 'Literal') check(node, node.source.value);
			}
		};
	}
};
