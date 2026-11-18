export class PyFloat {
	readonly value: number;
	constructor(value: number) {
		this.value = value;
	}
}

export type PyNumber = number | PyFloat;

export const numberOf = (n: PyNumber): number => (n instanceof PyFloat ? n.value : n);

const pythonFloatText = /^\s*[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?\s*$/;

export function pythonFloat(text: string): PyFloat {
	if (!pythonFloatText.test(text)) throw new Error(`float() cannot parse ${JSON.stringify(text)}`);
	return new PyFloat(Number(text));
}

const integerLikeKey = /^\d+$/;

export function parsePythonJson(text: string, origin: string): unknown {
	return JSON.parse(text, function (this: unknown, key: string, value: unknown, context?: { source?: string }) {
		if (!Array.isArray(this) && integerLikeKey.test(key)) {
			throw new Error(`${origin}: object key ${JSON.stringify(key)} is integer-like, which JS reorders; rename it`);
		}
		return typeof value === 'number' && /[.eE]/.test(context?.source ?? '') ? new PyFloat(value) : value;
	});
}

export function floatRepr(n: number): string {
	if (!Number.isFinite(n)) throw new Error(`no JSON form for ${n}`);
	if (n === 0) return Object.is(n, -0) ? '-0.0' : '0.0';
	const sign = n < 0 ? '-' : '';
	const [mantissa = '', exponentText = ''] = Math.abs(n).toExponential().split('e');
	const exponent = Number(exponentText);
	const digits = mantissa.replace('.', '');
	if (exponent < -4 || exponent >= 16) {
		const head = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
		return `${sign}${head}e${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
	}
	if (exponent < 0) return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
	return `${sign}${digits.slice(0, exponent + 1).padEnd(exponent + 1, '0')}.${digits.slice(exponent + 1) || '0'}`;
}

function numberRepr(n: PyNumber): string {
	if (n instanceof PyFloat) return floatRepr(n.value);
	if (!Number.isInteger(n)) return floatRepr(n);
	if (!Number.isSafeInteger(n)) throw new Error(`integer ${n} is outside the exact range`);
	return String(n);
}

const shortEscapes: Record<string, string> = {
	'"': '\\"',
	'\\': '\\\\',
	'\b': '\\b',
	'\f': '\\f',
	'\n': '\\n',
	'\r': '\\r',
	'\t': '\\t'
};

function jsonString(text: string): string {
	let out = '"';
	for (let i = 0; i < text.length; i++) {
		const unit = text.charCodeAt(i);
		const char = text[i] ?? '';
		const short = shortEscapes[char];
		if (short) out += short;
		else if (unit < 0x20 || unit > 0x7e) out += `\\u${unit.toString(16).padStart(4, '0')}`;
		else out += char;
	}
	return `${out}"`;
}

const entriesOf = (value: object): [string, unknown][] =>
	value instanceof Map ? [...(value as Map<string, unknown>)] : Object.entries(value);

function encode(value: unknown, indent: number | undefined, depth: number): string {
	if (value === null) return 'null';
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'number' || value instanceof PyFloat) return numberRepr(value);
	if (typeof value === 'string') return jsonString(value);
	if (typeof value !== 'object') throw new Error(`no JSON form for ${typeof value}`);
	const isArray = Array.isArray(value);
	const items = isArray
		? value.map((item) => encode(item, indent, depth + 1))
		: entriesOf(value).map(([key, item]) => `${jsonString(key)}: ${encode(item, indent, depth + 1)}`);
	const [open, close] = isArray ? ['[', ']'] : ['{', '}'];
	if (items.length === 0) return `${open}${close}`;
	if (indent === undefined) return `${open}${items.join(', ')}${close}`;
	const inner = `\n${' '.repeat(indent * (depth + 1))}`;
	return `${open}${inner}${items.join(`,${inner}`)}\n${' '.repeat(indent * depth)}${close}`;
}

export function pythonJsonDumps(value: unknown, indent?: number): string {
	return encode(value, indent, 0);
}

const unprintable = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u;

function stringRepr(text: string): string {
	const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
	let out = quote;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (char === quote || char === '\\') out += `\\${char}`;
		else if (char === '\t') out += '\\t';
		else if (char === '\n') out += '\\n';
		else if (char === '\r') out += '\\r';
		else if (char === ' ' || !unprintable.test(char)) out += char;
		else if (code <= 0xff) out += `\\x${code.toString(16).padStart(2, '0')}`;
		else if (code <= 0xffff) out += `\\u${code.toString(16).padStart(4, '0')}`;
		else out += `\\U${code.toString(16).padStart(8, '0')}`;
	}
	return `${out}${quote}`;
}

export function pythonRepr(value: unknown): string {
	if (value === null) return 'None';
	if (typeof value === 'boolean') return value ? 'True' : 'False';
	if (typeof value === 'number' || value instanceof PyFloat) return numberRepr(value);
	if (typeof value === 'string') return stringRepr(value);
	if (Array.isArray(value)) return `[${value.map(pythonRepr).join(', ')}]`;
	if (typeof value === 'object') {
		return `{${entriesOf(value)
			.map(([key, item]) => `${stringRepr(key)}: ${pythonRepr(item)}`)
			.join(', ')}}`;
	}
	throw new Error(`no repr for ${typeof value}`);
}

export function pythonStr(value: unknown): string {
	return typeof value === 'string' ? value : pythonRepr(value);
}
