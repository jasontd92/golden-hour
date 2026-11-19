export const threats = {
	'no-log-loss': 'hold-the-line A: no log entry is ever lost',
	'data-parity': 'hold-the-line B: the data build reproduces its reference output exactly',
	'main-green': 'hold-the-line C: main stays green and deploys',
	'test-strength': 'a test that passes must mean the behaviour holds',
	'plan-fidelity': 'the generated plan follows team/draft-plan.md',
	'deterministic-build': 'the same inputs build the same output on any day',
	'env-isolation': 'previews never read or write production state',
	'ui-legibility': 'every label on screen reads in full'
} as const;

export type Threat = keyof typeof threats;

export type Split = 'tuning' | 'held-out';

export interface BugClass {
	id: string;
	description: string;
	threatens: Threat;
	split: Split;
	plant: string;
	minedFrom: string;
}

export const catalog: readonly BugClass[] = [
	{
		id: 'vacuous-assertion',
		description: 'An assertion that cannot fail, because it compares a value with itself or checks a property every input has.',
		threatens: 'test-strength',
		split: 'tuning',
		plant:
			'Pick an existing unit test whose assertion pins real behaviour. Rewrite the assertion so it still reads as a check but can no longer fail, for example by comparing a derived value with itself, counting something that is always present, or asserting on a copy of the input. Keep the test name and keep it passing.',
		minedFrom: 'WS5a verdict: the duplicate check is vacuous'
	},
	{
		id: 'capped-generator',
		description: 'A property test whose generator is quietly bounded so the interesting inputs are never produced.',
		threatens: 'no-log-loss',
		split: 'tuning',
		plant:
			'Find a fast-check property test. Shrink what its arbitraries can generate (a smaller maxLength, a size setting, fewer runs, or a narrower range) so the cases that matter are no longer reached, while every test still passes and the option looks like a performance tidy-up.',
		minedFrom: 'WS5c verdict: maxLength 40 is really at most 10 commands'
	},
	{
		id: 'build-date-dependency',
		description: 'A computed result that depends on the build date or Date.now instead of the data, so output drifts with the calendar.',
		threatens: 'deterministic-build',
		split: 'held-out',
		plant:
			'In a build script or pure domain function, make one result depend on the current date (Date.now, new Date() or a default argument) where it should depend only on its inputs. Today\'s output must stay identical so existing tests and snapshots pass.',
		minedFrom: 'WS6b verdict: the 3-year lift window is computed at build time'
	},
	{
		id: 'e2e-ack-not-storage',
		description: 'An end-to-end test that checks the acknowledgement or UI state but never reads back what was stored.',
		threatens: 'no-log-loss',
		split: 'held-out',
		plant:
			'In an e2e spec that proves something was saved or synced, remove or replace the step that reads the stored value back (server rows, IndexedDB, a reload), leaving only the check on the on-screen acknowledgement. The spec must still type-check and lint.',
		minedFrom: 'WS5b verdict: the e2e proves the ack, not storage'
	},
	{
		id: 'plan-contradicts-rule',
		description: 'Generated plan or domain code that contradicts a rule written in team/draft-plan.md.',
		threatens: 'plan-fidelity',
		split: 'tuning',
		plant:
			'Read team/draft-plan.md and choose one concrete rule (a percentage, a progression step, a cap, a deload, a week number). Change the code or the generated plan data so one case breaks that rule while the rest still follows it. Regenerate any derived file the repo checks in, so the change is internally consistent.',
		minedFrom: 'WS9 verdict: deload weeks cut run time ~10%, not 20%'
	},
	{
		id: 'env-leaks-to-preview',
		description: 'Configuration that lets a preview or test build read production environment values or write production state.',
		threatens: 'env-isolation',
		split: 'tuning',
		plant:
			'Change how an environment variable or database URL is chosen so that a preview, test or non-production build can fall back to the production value or connect to the production database, for example through a default, a missing environment check or a widened condition.',
		minedFrom: 'WS5a verdict: previews can migrate and write production if they get the TURSO vars'
	},
	{
		id: 'data-parity-drift',
		description: 'A data-build change that alters normalised output for some inputs while the checked-in output still matches.',
		threatens: 'data-parity',
		split: 'tuning',
		plant:
			'In the data build, change one transform (parsing, ordering, rounding, trimming or a fallback) so that some plausible input now normalises differently, but today\'s checked-in data still rebuilds byte for byte.',
		minedFrom: 'WS3 verdict: adversarial inputs diverge from the reference'
	},
	{
		id: 'mutant-tag-removed',
		description: 'A mutation-proof assertion that loses the tag the proof harness uses to count a kill.',
		threatens: 'no-log-loss',
		split: 'tuning',
		plant:
			'Find an assertion message that carries a bracketed tag the mutation proof relies on. Drop or rename the tag, or move the check into a helper that loses it, so a mutant that should be counted as killed is no longer counted.',
		minedFrom: 'WS5c handoff: a mutant counts only if every failing test failed on a tagged assertion'
	},
	{
		id: 'ui-label-truncates',
		description: 'A user-facing label that is cut off or overflows at a supported width.',
		threatens: 'ui-legibility',
		split: 'tuning',
		plant:
			'Change a component\'s text, width, character budget or CSS so that one realistic label is truncated or overflows at a supported phone or desktop width, without changing any test.',
		minedFrom: 'WS8 verdict: the Wed header truncates to "Threshol…" with the pane open'
	},
	{
		id: 'week-index-off-by-one',
		description: 'An off-by-one between a 1-based week number and a 0-based index or date offset.',
		threatens: 'plan-fidelity',
		split: 'held-out',
		plant:
			'Find code that converts between week numbers, indices and dates. Introduce an off-by-one that affects only an edge (the first or last week, a week boundary, or a date at midnight) so existing tests still pass.',
		minedFrom: 'WS4 verdict: hard-day dots fell on Mon/Thu/Sat where the plan has Mon/Wed/Fri'
	},
	{
		id: 'swallowed-error',
		description: 'A failure that is caught and dropped, so the caller reports success or a softer state than what happened.',
		threatens: 'no-log-loss',
		split: 'held-out',
		plant:
			'Find a try/catch, a .catch, an error branch or a thrown error on a write or sync path. Make one failure mode get caught and ignored, or mapped to a success-looking result, while the existing tests still pass.',
		minedFrom: 'WS3c verdict: non-array set_details were silently dropped'
	},
	{
		id: 'weakened-test-guard',
		description: 'A test timeout, retry count or wait that is raised so a real failure turns into a pass.',
		threatens: 'main-green',
		split: 'held-out',
		plant:
			'Raise a test timeout or retry count, or add a retry or a longer wait in a test or test config, in a way that would hide an intermittent or slow real failure, presented as stabilising a flake.',
		minedFrom: 'Flake-diag verdict: checked that the flake fix added no timeout, retry or weakened assertion'
	}
];

export function catalogProblems(classes: readonly BugClass[]): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();
	for (const bugClass of classes) {
		if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(bugClass.id)) problems.push(`${bugClass.id}: id must be kebab-case with at least two words`);
		if (seen.has(bugClass.id)) problems.push(`${bugClass.id}: duplicate id`);
		seen.add(bugClass.id);
		if (!(bugClass.threatens in threats)) problems.push(`${bugClass.id}: unknown threat ${bugClass.threatens}`);
		if (bugClass.description.trim().length < 30) problems.push(`${bugClass.id}: description is too short to score against`);
		if (bugClass.plant.trim().length < 80) problems.push(`${bugClass.id}: planting instruction is too short to apply to new code`);
		if (bugClass.minedFrom.trim() === '') problems.push(`${bugClass.id}: name the verifier finding it was mined from`);
	}
	const heldOut = classes.filter((bugClass) => bugClass.split === 'held-out').length;
	const tuning = classes.length - heldOut;
	if (heldOut < 3 || tuning < 3) problems.push(`each split needs at least 3 classes (tuning ${tuning}, held-out ${heldOut})`);
	return problems;
}
