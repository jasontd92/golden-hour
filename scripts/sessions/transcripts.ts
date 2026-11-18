import * as nodeFs from 'node:fs';
import path from 'node:path';

export type TranscriptFs = Pick<
	typeof nodeFs,
	'closeSync' | 'existsSync' | 'openSync' | 'readFileSync' | 'readSync' | 'readdirSync' | 'statSync'
>;

export const readChunkBytes = 4096;

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
	finished: boolean;
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

function jsonlFilesUnder(fs: TranscriptFs, dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((entry) => entry.endsWith('.jsonl'))
		.map((entry) => path.join(dir, entry))
		.filter((file) => fs.statSync(file).isFile());
}

export function candidateTranscripts(projectsDir: string, root: string, fs: TranscriptFs = nodeFs): string[] {
	const base = root.replace(/\/+$/, '');
	const repoDir = encodeProjectDir(base);
	const orchestratorDir = encodeProjectDir(path.dirname(base));
	if (!fs.existsSync(projectsDir)) return [];
	return fs.readdirSync(projectsDir, { encoding: 'utf8' }).flatMap((name) => {
		const isRepoDir = name === repoDir || name.startsWith(`${repoDir}-wt-`);
		if (!isRepoDir && name !== orchestratorDir) return [];
		const dir = path.join(projectsDir, name);
		if (!fs.statSync(dir).isDirectory()) return [];
		if (isRepoDir) return jsonlFilesUnder(fs, dir);
		return fs.readdirSync(dir, { encoding: 'utf8' }).flatMap((session) => {
			const subagents = path.join(dir, session, 'subagents');
			return fs.existsSync(subagents) ? jsonlFilesUnder(fs, subagents) : [];
		});
	});
}

function* jsonLines(fs: TranscriptFs, file: string): Generator<string> {
	const fd = fs.openSync(file, 'r');
	try {
		const chunk = Buffer.alloc(readChunkBytes);
		let partial: Buffer[] = [];
		for (let read = fs.readSync(fd, chunk); read > 0; read = fs.readSync(fd, chunk)) {
			const bytes = Buffer.from(chunk.subarray(0, read));
			let start = 0;
			for (let newline = bytes.indexOf(0x0a); newline !== -1; newline = bytes.indexOf(0x0a, start)) {
				partial.push(bytes.subarray(start, newline));
				yield Buffer.concat(partial).toString('utf8');
				partial = [];
				start = newline + 1;
			}
			if (start < read) partial.push(bytes.subarray(start));
		}
		if (partial.length > 0) yield Buffer.concat(partial).toString('utf8');
	} finally {
		fs.closeSync(fd);
	}
}

function* jsonRecords(fs: TranscriptFs, file: string): Generator<JsonObject> {
	for (const line of jsonLines(fs, file)) {
		if (!line.trim()) continue;
		let record: unknown;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}
		if (isObject(record)) yield record;
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

function sessionMeta(fs: TranscriptFs, file: string): { label: string; finished: boolean } {
	const base = path.basename(file, '.jsonl');
	const fallback = base.startsWith('agent-') ? base.slice(0, 14) : `session-${base.slice(0, 8)}`;
	const metaFile = file.replace(/\.jsonl$/, '.meta.json');
	if (!fs.existsSync(metaFile)) return { label: fallback, finished: false };
	try {
		const meta: unknown = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
		if (!isObject(meta)) return { label: fallback, finished: false };
		return {
			label: typeof meta.name === 'string' && meta.name ? meta.name : fallback,
			finished: meta.finished === true
		};
	} catch {
		return { label: fallback, finished: false };
	}
}

export function readRepoTranscript(
	file: string,
	isRepoCwd: (cwd: string) => boolean,
	fs: TranscriptFs = nodeFs
): Transcript | null {
	const transcript: Transcript = {
		file,
		label: '',
		start: null,
		end: null,
		calls: [],
		results: new Map(),
		usage: new Map(),
		finished: false
	};
	const seenCalls = new Set<string>();
	let decided = false;

	for (const record of jsonRecords(fs, file)) {
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
	const meta = sessionMeta(fs, file);
	transcript.label = meta.label;
	transcript.finished = meta.finished;
	return transcript;
}
