import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LiftsFile, Result, ScoreType, WorkoutsFile } from '#lib/domain/history.ts';
import {
	compileMatchPattern,
	MovementVocabulary,
	movementTaggers,
	summarizeTags,
	tagMovements
} from '#lib/domain/movements.ts';
import { parseScore } from '#lib/domain/score.ts';
import { parseCsvRecords } from './csv.ts';
import {
	numberOf,
	parsePythonJson,
	PyFloat,
	type PyNumber,
	pythonFloat,
	pythonJsonDumps,
	pythonRepr,
	pythonStr
} from './python-json.ts';

export const dataDir = 'data';
export const normalizedDir = path.join(dataDir, 'normalized');
const sugarwodExport = 'raw/sugarwod/workouts_export_2026-11-17.csv';
const snapshotSource = 'sugarwod-snapshot-2026-11-17';

type Json = Record<string, unknown>;

interface CuratedWorkout extends Json {
	id: string;
	name: string;
	kind: string;
	aliases?: string[];
	description?: string | null;
	descriptions?: string[];
	definition_status?: string;
	sources: string[];
	score: { type: ScoreType; better: string | null };
	tags?: Json;
}

interface CuratedResult {
	w: string;
	src: string;
	score?: string | null;
	date?: string | null;
	prec?: string;
	lifts?: Record<string, PyNumber>;
	[key: string]: unknown;
}

interface BuiltResult extends Json {
	workout: string;
	date: string | null;
	score_display: string | null;
	value: PyNumber | null;
	source: string;
	conflict?: string | null;
	date_text?: string | null;
	barbell_lift?: string | null;
}

interface Snapshot {
	barbell_maxes_lb: ({ lift: string; note?: string } & Record<string, unknown>)[];
}

export function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const girls = new Set(
	'angie annie barbara chelsea cindy diane elizabeth fran grace helen isabel jackie karen linda mary nancy nicole amanda eva kelly lynne grettel ingrid marguerita candy maggie hope gwen megan'.split(
		' '
	)
);
const heroes = new Set(
	'murph dt jt the-chief hall zeus klepto the-standard michael nate badger randy josh jason-cunningham'.split(' ')
);
const competitionId = /^(open|agoq|games)-/;
const strengthText = compileMatchPattern('\\d+x\\d+|1x1|\\d-\\d-\\d|rm\\b|for load');

function guessKind(id: string, row: Record<string, string>): string {
	if (girls.has(id)) return 'girl';
	if (heroes.has(id)) return 'hero';
	if (competitionId.test(id)) return 'competition';
	const loadWithScheme = row.score_type === 'Load' && strengthText.test(`${row.title}${row.description}`.toLowerCase());
	if (row.barbell_lift || loadWithScheme) return 'strength';
	return 'class_wod';
}

const sugarwodScoreType = new Map<string, ScoreType>([
	['Load', 'load_lb'],
	['Rounds + Reps', 'rounds_reps'],
	['Reps', 'reps'],
	['Other / Text', 'text'],
	['Checkbox', 'checkbox'],
	['', 'time']
]);

const outsidePrintableAscii = /[^ -~]/u;

function plainScore<T extends string | null | undefined>(score: T, record: string): T {
	if (score !== null && score !== undefined && typeof score !== 'string') {
		throw new Error(`${record}: score ${JSON.stringify(score)} is a ${typeof score}; scores must be strings`);
	}
	const offending = score && outsidePrintableAscii.exec(score)?.[0];
	if (offending) {
		const codePoint = `U+${(offending.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
		throw new Error(`${record}: score ${JSON.stringify(score)} has ${codePoint}; scores must be printable ASCII`);
	}
	return score;
}

const clockWithFraction = /^\d+:\d{2}\.\d+$/;

function canonical(score: string | null | undefined, type: ScoreType): { value: PyNumber | null; unit: string | null } {
	if (score === null || score === undefined) return { value: null, unit: null };
	const text = score.trim();
	const parsed = parseScore(text, type);
	if (type === 'time') {
		if (!parsed) return { value: null, unit: 's' };
		return { value: clockWithFraction.test(text) ? new PyFloat(parsed.value) : parsed.value, unit: 's' };
	}
	if (!parsed) return { value: null, unit: null };
	return { value: new PyFloat(parsed.value), unit: parsed.unit ?? null };
}

function isoDate(usDate: string, record: string): string {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(usDate);
	const [, month = '', day = '', year = ''] = match ?? [];
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (!match || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
		throw new Error(`${record}: ${JSON.stringify(usDate)} is not a m/d/Y date`);
	}
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function setDetails(text: string, origin: string): Json[] {
	const sets = parsePythonJson(text, origin);
	if (!Array.isArray(sets)) throw new Error(`${origin}: expected a JSON array of sets, got ${text}`);
	const notSet = sets.findIndex((set) => typeof set !== 'object' || set === null || Array.isArray(set) || set instanceof PyFloat);
	if (notSet !== -1) throw new Error(`${origin}: set ${notSet} is not an object`);
	return sets as Json[];
}

const isEmpty = (value: unknown) =>
	value === null ||
	value === undefined ||
	(Array.isArray(value) && value.length === 0) ||
	(value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		!(value instanceof PyFloat) &&
		Object.keys(value).length === 0);

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
	return counts;
}

export interface NormalizedFiles {
	'workouts.json': string;
	'results.jsonl': string;
	'lifts.json': string;
	'REPORT.md': string;
}

export function buildNormalized(root = dataDir): NormalizedFiles {
	const readJson = (file: string) => parsePythonJson(readFileSync(path.join(root, file), 'utf8'), file);
	const vocabulary = MovementVocabulary.parse(readJson('curated/movements.json')).movements;
	const taggers = movementTaggers(vocabulary);
	const curatedWorkouts = readJson('curated/workouts.json') as CuratedWorkout[];

	const alias = new Map<string, string>();
	for (const workout of curatedWorkouts) {
		for (const name of [workout.name, ...(workout.aliases ?? [])]) alias.set(slug(name), workout.id);
	}
	const resolve = (title: string) => alias.get(slug(title)) ?? slug(title);

	const workouts = new Map<string, CuratedWorkout>(
		curatedWorkouts.map((workout) => [workout.id, { ...workout, sources: [...(workout.sources ?? [])] }])
	);
	const results: BuiltResult[] = [];
	const curatedLifts: [lift: string, evidence: Json][] = [];

	const rows = parseCsvRecords(readFileSync(path.join(root, sugarwodExport), 'utf8'));
	rows.forEach((row, index) => {
		const source = `sugarwod#row${index + 2}`;
		const id = resolve(row.title ?? '');
		const sets = row.set_details ? setDetails(row.set_details, `${source} set_details`) : [];
		let scoreType = sugarwodScoreType.get(row.score_type ?? '') ?? 'text';
		const first = sets[0];
		const hasClock = first !== undefined && ('mins' in first || 'secs' in first);
		if (scoreType === 'time' && !hasClock && row.score_type === '' && sets.length === 0) scoreType = 'text';
		let workout = workouts.get(id);
		if (!workout) {
			workout = {
				id,
				name: row.title ?? '',
				kind: guessKind(id, row),
				descriptions: [],
				score: { type: scoreType, better: scoreType === 'time' ? 'lower' : 'higher' },
				sources: []
			};
			workouts.set(id, workout);
		}
		const description = row.description ?? '';
		if (description) {
			workout.descriptions ??= [];
			if (!workout.descriptions.includes(description)) workout.descriptions.push(description);
		}
		if (!workout.sources.includes(sugarwodExport)) workout.sources.push(sugarwodExport);
		const type = workout.score.type;
		const raw = plainScore(row.best_result_raw ?? '', `${source} best_result_raw`);
		let { value, unit } = canonical(plainScore(row.best_result_display, `${source} best_result_display`), type);
		if (type === 'load_lb') {
			const load = raw ? numberOf(pythonFloat(raw)) : 0;
			value = load === 0 ? null : new PyFloat(load);
			unit = 'lb';
		}
		if (type === 'time' && value === null && /^\d+$/.test(raw)) {
			value = pythonFloat(raw);
			unit = 's';
		}
		results.push({
			workout: id,
			date: isoDate(row.date ?? '', `${source} date`),
			date_precision: 'day',
			score_display: row.best_result_display ?? '',
			value,
			unit,
			rx: (row.rx_or_scaled ?? '').toLowerCase(),
			pr_flag: Boolean(row.pr),
			barbell_lift: slug(row.barbell_lift ?? '') || null,
			sets: sets.length > 0 ? sets : null,
			notes: row.notes || null,
			source
		});
	});

	(readJson('curated/results.json') as CuratedResult[]).forEach((curated, index) => {
		const workout = workouts.get(curated.w);
		if (!workout) throw new Error(`curated result names unknown workout ${curated.w}`);
		const type = workout.score.type;
		const score = plainScore(curated.score, `curated/results.json[${index}] (${curated.w} ${curated.date ?? 'undated'})`);
		let { value, unit } = canonical(score, type);
		if (type === 'load_lb' && score) {
			value = pythonFloat(score);
			unit = 'lb';
		}
		const field = (key: string) => curated[key] ?? null;
		results.push({
			workout: curated.w,
			date: curated.date ?? null,
			date_precision: 'prec' in curated ? curated.prec : 'day',
			date_text: field('date_text') as string | null,
			score_display: curated.score ?? null,
			value,
			unit,
			rx: field('rx'),
			detail: field('detail'),
			splits: field('splits'),
			location: field('loc'),
			test_round: field('round'),
			notes: field('notes'),
			duplicate_of: field('dup_of'),
			conflict: field('conflict') as string | null,
			source: curated.src
		});
		for (const [lift, load] of Object.entries(curated.lifts ?? {})) {
			curatedLifts.push([lift, { date: curated.date ?? null, load, reps: 1, source: curated.src, note: workout.name }]);
		}
	});

	for (const workout of workouts.values()) {
		const text = [workout.name, workout.description, ...(workout.descriptions ?? [])].filter(Boolean).join(' ');
		const movements = tagMovements(text, taggers);
		const summary = summarizeTags(movements, vocabulary);
		workout.tags = {
			movements,
			patterns: summary.patterns,
			modality: summary.modality,
			home_ok_auto: summary.homeOk,
			tag_source: 'auto'
		};
	}

	const lifts = new Map<string, Json[]>();
	const addLift = (lift: string, evidence: Json) => lifts.set(lift, [...(lifts.get(lift) ?? []), evidence]);
	for (const result of results) {
		if (result.barbell_lift && result.value !== null && numberOf(result.value) !== 0) {
			addLift(result.barbell_lift, { date: result.date, load: result.value, reps: null, source: result.source });
		}
	}
	for (const [lift, evidence] of curatedLifts) addLift(lift, evidence);
	const snapshot = readJson('curated/sugarwod_snapshot_2026-11-17.json') as Snapshot;
	for (const max of snapshot.barbell_maxes_lb) {
		for (const key of ['1RM', '2RM', '3RM', '5RM']) {
			if (!(key in max)) continue;
			addLift(max.lift, {
				date: null,
				load: max[key],
				reps: Number(key[0]),
				source: snapshotSource,
				note: max.note ?? null
			});
		}
	}

	results.sort((a, b) => compareText(a.date ?? '0000', b.date ?? '0000') || compareText(a.workout, b.workout));
	const sortedWorkouts = [...workouts.values()].sort((a, b) => compareText(a.id, b.id));
	const resultLines = results.map(
		(result) => `${pythonJsonDumps(Object.fromEntries(Object.entries(result).filter(([, v]) => !isEmpty(v))))}\n`
	);

	return {
		'workouts.json': pythonJsonDumps(sortedWorkouts, 1),
		'results.jsonl': resultLines.join(''),
		'lifts.json': pythonJsonDumps(lifts, 1),
		'REPORT.md': renderReport([...workouts.values()], results, lifts.size)
	};
}

function renderReport(workouts: CuratedWorkout[], results: BuiltResult[], liftCount: number): string {
	const kindOf = new Map(workouts.map((workout) => [workout.id, workout.kind]));
	const byWorkout = new Map<string, BuiltResult[]>();
	for (const result of results) byWorkout.set(result.workout, [...(byWorkout.get(result.workout) ?? []), result]);
	const recurring = [...byWorkout]
		.filter(
			([id, rs]) => new Set(rs.map((r) => r.date || (r.date_text ?? null))).size >= 2 && kindOf.get(id) !== 'strength'
		)
		.map(([id, rs]) => [id, rs.length] as const)
		.sort((a, b) => b[1] - a[1]);
	const untagged = workouts
		.filter((workout) => (workout.tags?.movements as unknown[]).length === 0 && workout.kind !== 'test')
		.map((workout) => workout.id);
	const missing = workouts
		.filter((workout) => workout.definition_status)
		.map((workout) => `${workout.id}: ${workout.definition_status}`);
	const conflicts = results.filter((result) => result.conflict);
	const unparsed = results.filter((result) => result.value === null && result.score_display);
	const dates = results.flatMap((result) => (result.date ? [result.date] : [])).sort(compareText);
	const lines = [
		'# Data build report',
		'',
		`- ${workouts.length} workouts, ${results.length} results, dated ${dates[0]} → ${dates.at(-1)}`,
		`- workout kinds: ${pythonRepr(countBy(workouts, (workout) => workout.kind))}`,
		`- lifts with rep-max evidence: ${liftCount}`,
		'',
		'## Definition problems',
		...missing.map((line) => `- ${line}`),
		'',
		'## Recurring (≥2 dated results, non-strength): comparison anchors',
		...recurring.map(([id, count]) => `- ${id} (${count})`),
		'',
		'## Conflicts between sources (kept, not resolved)',
		...conflicts.map((r) => `- ${r.workout} ${pythonStr(r.date)}: ${pythonStr(r.conflict)}`),
		'',
		`## Scores that did not parse to a number (${unparsed.length})`,
		...unparsed.slice(0, 40).map((r) => `- ${r.workout} ${pythonStr(r.date)}: ${pythonRepr(r.score_display)}`),
		'',
		`## Untagged workouts: no movement matched (${untagged.length})`,
		...untagged.sort(compareText).map((id) => `- ${id}`),
		''
	];
	return lines.join('\n');
}

export function validateNormalized(files: NormalizedFiles): string[] {
	const problems: string[] = [];
	const check = (file: string, parsed: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => {
		for (const issue of parsed.error?.issues ?? []) problems.push(`${file}: ${issue.path.join('.')}: ${issue.message}`);
	};
	check('workouts.json', WorkoutsFile.safeParse(JSON.parse(files['workouts.json'])));
	check('lifts.json', LiftsFile.safeParse(JSON.parse(files['lifts.json'])));
	files['results.jsonl']
		.trimEnd()
		.split('\n')
		.forEach((line, index) => check(`results.jsonl:${index + 1}`, Result.safeParse(JSON.parse(line))));
	return problems;
}

if (import.meta.main) {
	const outDir = process.argv[2] ?? normalizedDir;
	const files = buildNormalized();
	const problems = validateNormalized(files);
	if (problems.length > 0) {
		for (const problem of problems) console.error(problem);
		process.exit(1);
	}
	mkdirSync(outDir, { recursive: true });
	for (const [name, content] of Object.entries(files)) writeFileSync(path.join(outDir, name), content);
	console.log(files['REPORT.md'].split('\n').slice(0, 6).join('\n'));
}
