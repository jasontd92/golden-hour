import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

export interface ToolCall {
	id: string;
	name: string;
	input: Record<string, unknown>;
	at: number;
}

export interface ToolResult {
	isError: boolean;
	text: string;
	prNumbers: number[];
}

export interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface Transcript {
	file: string;
	label: string;
	start: number | null;
	end: number | null;
	calls: ToolCall[];
	results: Map<string, ToolResult>;
	usage: Map<string, Usage>;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function repoCwdMatcher(root: string): (cwd: string) => boolean {
	const base = root.replace(/\/+$/, '');
	return (cwd) => cwd === base || cwd.startsWith(`${base}/`) || cwd.startsWith(`${base}-wt/`);
}

export function encodeProjectDir(dir: string): string {
	return dir.replace(/[^A-Za-z0-9]/g, '-');
}

function jsonlFilesUnder(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((entry) => entry.endsWith('.jsonl'))
		.map((entry) => path.join(dir, entry))
		.filter((file) => statSync(file).isFile());
}

export function candidateTranscripts(projectsDir: string, root: string): string[] {
	const encodedRoot = encodeProjectDir(root.replace(/\/+$/, ''));
	if (!existsSync(projectsDir)) return [];
	return readdirSync(projectsDir).flatMap((name) => {
		const dir = path.join(projectsDir, name);
		if (!statSync(dir).isDirectory()) return [];
		if (name.startsWith(encodedRoot)) return jsonlFilesUnder(dir);
		if (encodedRoot !== name && !encodedRoot.startsWith(`${name}-`)) return [];
		return readdirSync(dir).flatMap((session) => {
			const subagents = path.join(dir, session, 'subagents');
			return existsSync(subagents) ? jsonlFilesUnder(subagents) : [];
		});
	});
}

async function* jsonRecords(file: string): AsyncGenerator<JsonObject> {
	const input = createReadStream(file, { encoding: 'utf8' });
	const lines = createInterface({ input, crlfDelay: Infinity });
	try {
		for await (const line of lines) {
			if (!line.trim()) continue;
			let record: unknown;
			try {
				record = JSON.parse(line);
			} catch {
				continue;
			}
			if (isObject(record)) yield record;
		}
	} finally {
		lines.close();
		input.destroy();
	}
}

function resultText(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter(isObject)
		.map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
		.join('\n');
}

function gitOperationPrs(record: JsonObject): number[] {
	const result = record.toolUseResult;
	if (!isObject(result) || !isObject(result.gitOperation)) return [];
	const pr = result.gitOperation.pr;
	if (!isObject(pr) || typeof pr.number !== 'number') return [];
	return pr.action === 'created' || pr.action === 'merged' ? [pr.number] : [];
}

function sessionLabel(file: string): string {
	const base = path.basename(file, '.jsonl');
	const metaFile = file.replace(/\.jsonl$/, '.meta.json');
	if (existsSync(metaFile)) {
		try {
			const meta: unknown = JSON.parse(readFileSync(metaFile, 'utf8'));
			if (isObject(meta) && typeof meta.name === 'string' && meta.name) return meta.name;
		} catch {
			return base.slice(0, 14);
		}
	}
	return base.startsWith('agent-') ? base.slice(0, 14) : `session-${base.slice(0, 8)}`;
}

export async function readRepoTranscript(
	file: string,
	isRepoCwd: (cwd: string) => boolean
): Promise<Transcript | null> {
	const transcript: Transcript = {
		file,
		label: '',
		start: null,
		end: null,
		calls: [],
		results: new Map(),
		usage: new Map()
	};
	const seenCalls = new Set<string>();
	let decided = false;

	for await (const record of jsonRecords(file)) {
		if (typeof record.cwd === 'string') {
			if (!decided && !isRepoCwd(record.cwd)) return null;
			decided = true;
			if (!isRepoCwd(record.cwd)) continue;
		}
		if (record.type !== 'assistant' && record.type !== 'user') continue;
		if (!isObject(record.message)) continue;

		const at = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : NaN;
		if (!Number.isNaN(at)) {
			transcript.start = transcript.start === null ? at : Math.min(transcript.start, at);
			transcript.end = transcript.end === null ? at : Math.max(transcript.end, at);
		}
		const { content } = record.message;

		if (record.type === 'assistant') {
			const { id, usage } = record.message;
			if (typeof id === 'string' && isObject(usage)) {
				transcript.usage.set(id, {
					input: asNumber(usage.input_tokens),
					output: asNumber(usage.output_tokens),
					cacheRead: asNumber(usage.cache_read_input_tokens),
					cacheWrite: asNumber(usage.cache_creation_input_tokens)
				});
			}
			if (!Array.isArray(content)) continue;
			for (const block of content) {
				if (!isObject(block) || block.type !== 'tool_use') continue;
				if (typeof block.id !== 'string' || typeof block.name !== 'string') continue;
				if (seenCalls.has(block.id)) continue;
				seenCalls.add(block.id);
				transcript.calls.push({
					id: block.id,
					name: block.name,
					input: isObject(block.input) ? block.input : {},
					at: Number.isNaN(at) ? (transcript.end ?? 0) : at
				});
			}
			continue;
		}

		if (!Array.isArray(content)) continue;
		for (const block of content) {
			if (!isObject(block) || block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
			transcript.results.set(block.tool_use_id, {
				isError: block.is_error === true,
				text: resultText(block.content),
				prNumbers: gitOperationPrs(record)
			});
		}
	}

	if (!decided) return null;
	transcript.label = sessionLabel(file);
	return transcript;
}
