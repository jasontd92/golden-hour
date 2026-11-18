import { parse } from 'yaml';
import featuresYaml from '../../../features.yaml?raw';

export function featureFlag(feature: string, flag: string, yaml: string = featuresYaml): boolean {
	const entries: unknown = parse(yaml);
	if (!Array.isArray(entries)) return false;
	const entry: unknown = entries.find((e: { name?: unknown }) => e?.name === feature);
	const flags = (entry as { flags?: Record<string, unknown> } | undefined)?.flags;
	return flags?.[flag] === true;
}
