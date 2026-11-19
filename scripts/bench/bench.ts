import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runAgent, type Usage } from './agents.ts';
import { catalog, type BugClass } from './catalog.ts';
import {
	cloneWithoutHistoryLeftovers,
	commitPatch,
	exportBase,
	headSha,
	install,
	isInside,
	resetWorkingTree,
	runGates,
	sh,
	workingDiff
} from './clone.ts';
import { leaks, pathLeaks } from './leak-check.ts';
import { addedHunks, changedFiles, sampleClasses, type Manifest, type Plant } from './manifest.ts';
import { mechanicalPlanters, type RepoView } from './mechanical.ts';
import { parsePlanterReport, planterPrompt } from './planter-prompt.ts';
import { formatScore, scoreRun } from './score.ts';
import { builtInMethod, verifierPrompt } from './verifier-prompt.ts';

interface Options {
	classes: number;
	dryRun: boolean;
	seed: number;
	work: string;
	ref: string;
	keep: boolean;
	method: string | null;
	planterUsd: number;
	verifierUsd: number;
}

function options(): Options {
	const { values } = parseArgs({
		options: {
			classes: { type: 'string', default: '3' },
			'dry-run': { type: 'boolean', default: false },
			seed: { type: 'string' },
			work: { type: 'string', default: path.join(os.tmpdir(), 'golden-hour-bench') },
			ref: { type: 'string', default: 'origin/main' },
			keep: { type: 'boolean', default: false },
			method: { type: 'string' },
			'planter-usd': { type: 'string', default: '3' },
			'verifier-usd': { type: 'string', default: '15' }
		}
	});
	return {
		classes: Number(values.classes),
		dryRun: values['dry-run'],
		seed: values.seed === undefined ? randomBytes(4).readUInt32BE() : Number(values.seed),
		work: path.resolve(values.work),
		ref: values.ref,
		keep: values.keep,
		method: values.method ?? null,
		planterUsd: Number(values['planter-usd']),
		verifierUsd: Number(values['verifier-usd'])
	};
}

function view(dir: string): RepoView {
	const files = sh(dir, 'git', ['ls-files']).stdout.split('\n').filter(Boolean);
	return { files, read: (file) => readFileSync(path.join(dir, file), 'utf8') };
}

const log = (line: string) => console.log(`[bench ${new Date().toISOString().slice(11, 19)}] ${line}`);

function plantOne(bugClass: BugClass, dir: string, avoid: string[], opts: Options, usage: Usage[], pick: (n: number) => number): Plant {
	const base = { classId: bugClass.id, split: bugClass.split, behavior: '', markers: [], cover: { title: '', claims: [] }, files: [], hunks: [], diff: '' };
	let planted: Pick<Plant, 'behavior' | 'markers' | 'cover' | 'how'>;
	if (opts.dryRun) {
		const mechanical = mechanicalPlanters[bugClass.id]?.(view(dir), pick) ?? null;
		if (mechanical === null) return { ...base, how: 'mechanical', status: 'not-planted', reason: 'no mechanical target in this code' };
		for (const edit of mechanical.edits) writeFileSync(path.join(dir, edit.file), edit.text);
		planted = { how: 'mechanical', behavior: mechanical.behavior, markers: mechanical.markers, cover: mechanical.cover };
	} else {
		const result = runAgent('planter', dir, planterPrompt(bugClass, avoid), opts.planterUsd);
		usage.push(result.usage);
		const report = parsePlanterReport(result.text);
		if (report === null) return { ...base, how: 'agent', status: 'not-planted', reason: result.error ?? 'planter gave no report block' };
		planted = { how: 'agent', ...report };
	}
	const diff = workingDiff(dir);
	const files = changedFiles(diff);
	const plant: Plant = { ...base, ...planted, status: 'planted', files, hunks: addedHunks(diff), diff };
	if (files.length === 0) return { ...plant, status: 'not-planted', reason: 'no change in the clone' };
	const shared = files.filter((file) => avoid.includes(file));
	if (shared.length > 0) return { ...plant, status: 'not-planted', reason: `touches ${shared.join(', ')}, used by another plant` };
	if (leaks('plant', [planted.cover.title, ...planted.cover.claims, diff].join('\n')).length > 0) {
		return { ...plant, status: 'not-planted', reason: 'the cover or diff names the class' };
	}
	log(`${bugClass.id}: planted in ${files.join(', ')}; running the mechanical gates`);
	const gates = runGates(dir);
	return gates.ok ? plant : { ...plant, status: 'caught-by-machine', reason: gates.gate, gateLog: gates.tail };
}

function usageLines(usage: Usage[], wallMs: number): string[] {
	const total = usage.reduce(
		(sum, entry) => ({
			cost: sum.cost + entry.costUsd,
			input: sum.input + entry.inputTokens + entry.cacheReadTokens + entry.cacheWriteTokens,
			output: sum.output + entry.outputTokens
		}),
		{ cost: 0, input: 0, output: 0 }
	);
	return [
		...usage.map(
			(entry) =>
				`${entry.role}: ${Math.round(entry.durationMs / 60000)} min, ${entry.turns} turns, in ${entry.inputTokens} (+${entry.cacheReadTokens} cache read, +${entry.cacheWriteTokens} cache write), out ${entry.outputTokens}, $${entry.costUsd.toFixed(2)}`
		),
		`agents total: $${total.cost.toFixed(2)}, ${total.input} input tokens (cache included), ${total.output} output tokens; wall time ${Math.round(wallMs / 60000)} min`
	];
}

function main(): number {
	const opts = options();
	const started = Date.now();
	if (process.env.CI && !opts.dryRun) {
		console.error('bench:verifiers launches paid agents and never runs in CI. Use --dry-run.');
		return 1;
	}
	const repo = path.dirname(sh(process.cwd(), 'git', ['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout.trim());
	if (isInside(opts.work, repo)) {
		console.error(`--work ${opts.work} is inside the repo; clones must live outside it.`);
		return 1;
	}
	const sha = sh(repo, 'git', ['rev-parse', opts.ref]).stdout.trim();
	const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${opts.seed}`;
	const runDir = path.join(opts.work, 'runs', runId);
	const sandbox = path.join(opts.work, 'clones', randomBytes(6).toString('hex'));
	mkdirSync(runDir, { recursive: true });
	const method = opts.method === null ? builtInMethod : readFileSync(opts.method, 'utf8');
	const promptLeaks = [...leaks('verifier method', method), ...pathLeaks([path.join(os.homedir(), '.claude', 'skills'), path.join(repo, '.claude')])];
	if (promptLeaks.length > 0) {
		for (const leak of promptLeaks) console.error(leak);
		return 1;
	}
	const usage: Usage[] = [];
	let seedState = opts.seed;
	const pick = (count: number) => (seedState = (seedState * 1103515245 + 12345) >>> 0) % count;
	try {
		const plantDir = path.join(sandbox, 'plant');
		log(`run ${runId}: base ${sha.slice(0, 7)} (${opts.ref}), work ${sandbox}`);
		exportBase(repo, sha, plantDir);
		install(plantDir);
		log('positive control: running the mechanical gates on the unplanted base');
		const control = runGates(plantDir);
		if (!control.ok) {
			console.error(`base is red before planting (${control.gate}):\n${control.tail}`);
			return 1;
		}
		const pool = opts.dryRun ? catalog.filter((bugClass) => bugClass.id in mechanicalPlanters) : catalog;
		const plants: Plant[] = [];
		for (const bugClass of sampleClasses(pool, opts.classes, opts.seed)) {
			const avoid = plants.filter((plant) => plant.status === 'planted').flatMap((plant) => plant.files);
			log(`${bugClass.id} (${bugClass.split}): planting ${opts.dryRun ? 'mechanically' : 'with an agent'}`);
			const plant = plantOne(bugClass, plantDir, avoid, opts, usage, pick);
			log(`${bugClass.id}: ${plant.status}${plant.reason ? ` (${plant.reason})` : ''}`);
			plants.push(plant);
			resetWorkingTree(plantDir);
		}
		const manifest: Manifest = { runId, baseSha: sha, createdAt: new Date().toISOString(), dryRun: opts.dryRun, plants };
		const live = plants.filter((plant) => plant.status === 'planted');
		let verdict: string | null = null;
		if (opts.dryRun) {
			console.log(JSON.stringify(manifest, null, 2));
		} else if (live.length > 0) {
			const baseSha = headSha(plantDir);
			const applied = live.filter((plant) => commitPatch(plantDir, plant.diff, plant.cover.title));
			if (applied.length !== live.length) throw new Error('a surviving plant no longer applies on top of the others');
			const verifyDir = path.join(sandbox, randomBytes(6).toString('hex'));
			cloneWithoutHistoryLeftovers(plantDir, verifyDir);
			const head = headSha(verifyDir);
			rmSync(plantDir, { recursive: true, force: true });
			install(verifyDir);
			const prompt = verifierPrompt(
				{ chunk: `BENCH-${opts.seed}`, clone: verifyDir, baseSha, headSha: head, changes: live.map((plant) => plant.cover) },
				method
			);
			const leaked = leaks('verifier prompt', prompt);
			if (leaked.length > 0) throw new Error(leaked.join('\n'));
			log(`verifier: reviewing ${baseSha.slice(0, 7)}..${head.slice(0, 7)} (${live.length} commits)`);
			const result = runAgent('verifier', verifyDir, prompt, opts.verifierUsd);
			usage.push(result.usage);
			verdict = result.text;
			if (result.error) log(`verifier: ${result.error}`);
			writeFileSync(path.join(runDir, 'verdict.md'), verdict);
		} else {
			log('every plant was caught by machine or not planted; no verifier run needed');
		}
		writeFileSync(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
		const report = [
			opts.dryRun
				? ['dry run, no verifier:', ...plants.map((plant) => `${plant.classId}  ${plant.split}  ${plant.status}${plant.reason ? ` (${plant.reason})` : ''}`)].join('\n')
				: formatScore(scoreRun(manifest, verdict)),
			'',
			...usageLines(usage, Date.now() - started)
		].join('\n');
		writeFileSync(path.join(runDir, 'report.txt'), `${report}\n`);
		writeFileSync(path.join(runDir, 'usage.json'), `${JSON.stringify(usage, null, 2)}\n`);
		console.log(`\n${report}\n\nresults: ${runDir}`);
		return 0;
	} finally {
		if (opts.keep) log(`kept clones in ${sandbox}`);
		else rmSync(sandbox, { recursive: true, force: true });
	}
}

process.exit(main());
