import type { ScoreType, ScoreUnit } from './history.ts';

export interface ParsedScore {
	value: number;
	unit?: ScoreUnit;
}

const clock = /^(\d+):(\d{2})(?::(\d{2}))?(\.\d+)?$/;
const roundsPlusReps = /^(\d+)\s*\+\s*(\d+)$/;
const plainNumber = /^-?\d+(\.\d+)?$/;
const unsignedNumber = /^\d+(\.\d+)?$/;

const numericUnit: Partial<Record<ScoreType, ScoreUnit>> = {
	load_lb: 'lb',
	reps: 'reps',
	seconds: 's',
	points: 'pts'
};

export function parseClock(text: string): number | undefined {
	const match = clock.exec(text.trim());
	if (!match) return undefined;
	const [, a = '', b = '', c, frac] = match;
	// why: Google Sheets turns mm:ss into hh:mm:00, so a zero third field means mm:ss.
	if (c === '00') return Number(a) * 60 + Number(b);
	if (c !== undefined) return Number(a) * 3600 + Number(b) * 60 + Number(c);
	return Number(a) * 60 + Number(b) + (frac ? Number(frac) : 0);
}

export function parseScore(score: string | number, type: ScoreType): ParsedScore | undefined {
	const text = String(score).trim();
	if (type === 'time') {
		const value = parseClock(text);
		return value === undefined ? undefined : { value, unit: 's' };
	}
	if (type === 'rounds_reps') {
		const match = roundsPlusReps.exec(text);
		if (match) return { value: Number(match[1]) + Number(match[2]) / 1000, unit: 'rounds.reps' };
		return unsignedNumber.test(text) ? { value: Number(text), unit: 'rounds' } : undefined;
	}
	if (!plainNumber.test(text)) return undefined;
	const unit = numericUnit[type];
	return unit ? { value: Number(text), unit } : { value: Number(text) };
}

function formatClock(seconds: number): string {
	const whole = Math.floor(seconds);
	const fraction = Number((seconds - whole).toFixed(3));
	const minutes = Math.floor(whole / 60);
	const rest = String(whole % 60).padStart(2, '0');
	return `${minutes}:${rest}${fraction > 0 ? String(fraction).slice(1) : ''}`;
}

export function formatScore(value: number, type: ScoreType): string {
	if (type === 'time') return formatClock(value);
	if (type === 'rounds_reps' && !Number.isInteger(value)) {
		const rounds = Math.floor(value);
		return `${rounds}+${Math.round((value - rounds) * 1000)}`;
	}
	return String(value);
}
