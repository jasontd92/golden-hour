import { z } from 'zod';

export const movementIds = [
	'thruster',
	'wall_ball',
	'overhead_squat',
	'front_squat',
	'back_squat',
	'air_squat',
	'pistol',
	'squat_snatch',
	'db_snatch',
	'power_snatch',
	'squat_clean',
	'power_clean',
	'clean_and_jerk',
	'jerk',
	'push_press',
	'shoulder_press',
	'bench_press',
	'deadlift',
	'sdhp',
	'kb_swing',
	'devils_press',
	'turkish_getup',
	'bear_complex',
	'lunge',
	'box_jump',
	'burpee',
	'pull_up',
	'chest_to_bar',
	'muscle_up',
	'ring_row',
	'weighted_row',
	'rope_climb',
	'hspu',
	'push_up',
	'dip',
	'handstand_walk',
	'toes_to_bar',
	'knees_to_elbow',
	'sit_up',
	'l_sit',
	'plank',
	'v_up',
	'double_under',
	'run',
	'row',
	'bike',
	'ski',
	'farmers_carry',
	'sled',
	'sandbag'
] as const;

export const MovementId = z.enum(movementIds);
export type MovementId = z.infer<typeof MovementId>;

export const Modality = z.enum(['M', 'G', 'W']);
export type Modality = z.infer<typeof Modality>;

export const MovementDefinition = z.strictObject({
	id: MovementId,
	pattern: z.string().min(1),
	modality: Modality,
	home: z.boolean(),
	match: z.array(z.string().min(1)).min(1)
});
export type MovementDefinition = z.infer<typeof MovementDefinition>;

export const MovementVocabulary = z.strictObject({
	_about: z.string().optional(),
	movements: z.array(MovementDefinition)
});
export type MovementVocabulary = z.infer<typeof MovementVocabulary>;

const wordChar = '\\p{L}\\p{N}_';
const wordBoundary = `(?:(?<=[${wordChar}])(?![${wordChar}])|(?<![${wordChar}])(?=[${wordChar}]))`;
const regexSyntax = new Set('^$\\.*+?()[]{}|/');
const plainEscapes = new Set('nrtfv');

// why: movements.json holds Python `re` patterns, where \b, \d and \w are Unicode-aware.
export function compileMatchPattern(source: string): RegExp {
	let out = '';
	let inClass = false;
	for (let i = 0; i < source.length; i++) {
		const char = source[i] ?? '';
		if (char !== '\\') {
			if (char === '[') inClass = true;
			else if (char === ']') inClass = false;
			out += char;
			continue;
		}
		const next = source[++i] ?? '';
		if (next === 'b' && !inClass) out += wordBoundary;
		else if (next === 'd') out += '\\p{Nd}';
		else if (next === 'w') out += inClass ? wordChar : `[${wordChar}]`;
		else if (plainEscapes.has(next) || (next === 'b' && inClass)) out += `\\${next}`;
		else if (/[A-Za-z0-9]/.test(next)) throw new Error(`unsupported escape \\${next} in ${source}`);
		else out += regexSyntax.has(next) || (next === '-' && inClass) ? `\\${next}` : next;
	}
	return new RegExp(out, 'u');
}

export interface MovementTagger {
	definition: MovementDefinition;
	patterns: RegExp[];
}

export function movementTaggers(vocabulary: MovementDefinition[]): MovementTagger[] {
	return vocabulary.map((definition) => ({ definition, patterns: definition.match.map(compileMatchPattern) }));
}

const blank = (span: string) => ' '.repeat([...span].length);

export function tagMovements(text: string, taggers: MovementTagger[]): MovementId[] {
	if (!text) return [];
	let rest = ` ${text.toLowerCase()} `;
	const found: MovementId[] = [];
	for (const { definition, patterns } of taggers) {
		for (const pattern of patterns) {
			const match = pattern.exec(rest);
			if (!match) continue;
			found.push(definition.id);
			rest = rest.slice(0, match.index) + blank(match[0]) + rest.slice(match.index + match[0].length);
			rest = rest.replace(new RegExp(pattern, 'gu'), blank);
			break;
		}
	}
	return found;
}

const modalityOrder = Modality.options;

export interface TagSummary {
	patterns: string[];
	modality: string;
	homeOk: boolean | null;
}

export function summarizeTags(ids: MovementId[], vocabulary: MovementDefinition[]): TagSummary {
	const byId = new Map(vocabulary.map((definition) => [definition.id, definition]));
	const used = ids.map((id) => {
		const definition = byId.get(id);
		if (!definition) throw new Error(`movement ${id} is not in the vocabulary`);
		return definition;
	});
	const patterns = [...new Set(used.flatMap((definition) => definition.pattern.split('+')))].sort();
	const modality = [...new Set(used.map((definition) => definition.modality))]
		.sort((a, b) => modalityOrder.indexOf(a) - modalityOrder.indexOf(b))
		.join('');
	return { patterns, modality, homeOk: used.length > 0 ? used.every((definition) => definition.home) : null };
}
