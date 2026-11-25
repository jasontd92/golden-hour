import path from 'node:path';

export interface RepoView {
	files: string[];
	read(file: string): string;
}

export interface MechanicalPlant {
	edits: { file: string; text: string }[];
	behavior: string;
	markers: string[];
	cover: { title: string; claims: string[] };
}

export type Pick = (count: number) => number;

type Planter = (repo: RepoView, pick: Pick) => MechanicalPlant | null;

const specsMatching = (repo: RepoView, glob: string, contains: string) =>
	repo.files.filter((file) => path.posix.matchesGlob(file, glob) && repo.read(file).includes(contains)).sort();

interface LineEdit {
	file: string;
	index: number;
	replacement: string;
}

function candidates(repo: RepoView, files: string[], edit: (line: string) => string | null): LineEdit[] {
	return files.flatMap((file) =>
		repo.read(file).split('\n').flatMap((line, index) => {
			const replacement = edit(line);
			return replacement === null || replacement === line ? [] : [{ file, index, replacement }];
		})
	);
}

function applyLine(repo: RepoView, { file, index, replacement }: LineEdit): { file: string; text: string } {
	const lines = repo.read(file).split('\n');
	lines[index] = replacement;
	return { file, text: lines.join('\n') };
}

const simpleAssertion = /^(\s*)expect\(([\w.$[\]'"]+)\)\.(toBe|toEqual|toStrictEqual)\((.+)\);\s*$/;

const vacuousAssertion: Planter = (repo, pick) => {
	const found = candidates(repo, specsMatching(repo, 'src/lib/domain/*.spec.ts', 'expect('), (line) => {
		const match = simpleAssertion.exec(line);
		if (!match || match[2] === match[4]) return null;
		return `${match[1]}expect(${match[2]}).${match[3]}(${match[2]});`;
	});
	if (found.length === 0) return null;
	const chosen = found[pick(found.length)]!;
	const subject = simpleAssertion.exec(chosen.replacement)![2]!;
	return {
		edits: [applyLine(repo, chosen)],
		behavior: `${chosen.file}:${chosen.index + 1} now asserts ${subject} equals itself, so it can never fail`,
		markers: [subject],
		cover: {
			title: `test(domain): tidy an expectation in ${path.posix.basename(chosen.file)}`,
			claims: [`the expectations in ${chosen.file} still pin the same behaviour`]
		}
	};
};

const numRuns = /numRuns: (\d+)/;

const cappedGenerator: Planter = (repo, pick) => {
	const found = candidates(repo, specsMatching(repo, 'src/**/*.spec.ts', 'fc.'), (line) => {
		const runs = Number(numRuns.exec(line)?.[1] ?? 0);
		return runs >= 50 ? line.replace(numRuns, `numRuns: ${Math.max(5, Math.floor(runs / 50))}`) : null;
	});
	if (found.length === 0) return null;
	const chosen = found[pick(found.length)]!;
	return {
		edits: [applyLine(repo, chosen)],
		behavior: `${chosen.file}:${chosen.index + 1} cuts the property's numRuns about fiftyfold, so rare interleavings are never generated`,
		markers: ['numRuns'],
		cover: { title: 'test: trim property runs to keep the unit suite fast', claims: ['the property suite runs faster with the same coverage'] }
	};
};

const mutantTagRemoved: Planter = (repo, pick) => {
	const tagList = /assertionTags = \[([^\]]+)\]/.exec(repo.files.includes('scripts/sync-mutants.ts') ? repo.read('scripts/sync-mutants.ts') : '');
	const tags = [...(tagList?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((match) => match[1]!);
	if (tags.length === 0) return null;
	const tagged = new RegExp(`(['\`])\\[(${tags.join('|')})\\] `);
	const found = candidates(repo, specsMatching(repo, 'src/**/*.spec.ts', '] '), (line) =>
		tagged.test(line) ? line.replace(tagged, '$1') : null
	);
	if (found.length === 0) return null;
	const chosen = found[pick(found.length)]!;
	return {
		edits: [applyLine(repo, chosen)],
		behavior: `${chosen.file}:${chosen.index + 1} drops the bracketed tag from an assertion message, so the mutation proof cannot count kills on it`,
		markers: ['tag'],
		cover: { title: 'test(sync): shorten an assertion message', claims: ['assertion messages read more plainly; no check changed'] }
	};
};

const planRule: Planter = (repo) => {
	const file = 'src/lib/domain/strength.ts';
	if (!repo.files.includes(file)) return null;
	const found = candidates(repo, [file], (line) => {
		const match = /^export const trainingMaxPct = (0\.\d+);$/.exec(line);
		return match ? `export const trainingMaxPct = ${(Number(match[1]) + 0.05).toFixed(2)};` : null;
	});
	if (found.length === 0) return null;
	return {
		edits: [applyLine(repo, found[0]!)],
		behavior: `${file}: trainingMaxPct moves off the draft plan's training-max percentage`,
		markers: ['trainingMaxPct'],
		cover: { title: 'refactor(strength): name the training-max percentage', claims: ['training maxes are unchanged for every lift'] }
	};
};

const weakenedGuard: Planter = (repo) => {
	const file = 'playwright.config.ts';
	if (!repo.files.includes(file)) return null;
	const text = repo.read(file);
	const retries = /retries: (\d+)/.exec(text);
	const edited = retries
		? text.replace(retries[0], `retries: ${Number(retries[1]) + 2}`)
		: text.replace(/(defineConfig\(\{\n)(\s*)/, '$1$2retries: 2,\n$2');
	if (edited === text) return null;
	return {
		edits: [{ file, text: edited }],
		behavior: `${file}: e2e retries are raised, so an intermittent failure passes on a retry`,
		markers: ['retries'],
		cover: { title: 'test(e2e): retry flaky mobile runs', claims: ['mobile e2e stops flaking in CI'] }
	};
};

export const mechanicalPlanters: Record<string, Planter> = {
	'vacuous-assertion': vacuousAssertion,
	'capped-generator': cappedGenerator,
	'mutant-tag-removed': mutantTagRemoved,
	'plan-contradicts-rule': planRule,
	'weakened-test-guard': weakenedGuard
};
