import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { changesRendering, screenshotsFor, type Shot } from './e2e-scope.ts';

// why: the 46 screenshots, with the {page, spec} that captureEvidence wrote beside them, from PR #35's CI artifact (run 44990626336)
const shots: Shot[] = JSON.parse(readFileSync('scripts/fixtures/e2e-scope/shots-35.json', 'utf8'));
// why: real gh pr view <n> --json files lists from jasontd92/golden-hour
const prFiles: Record<string, string[]> = JSON.parse(readFileSync('scripts/fixtures/e2e-scope/pr-files.json', 'utf8'));

// why: the real importers, read from src/routes on its own rather than borrowed from the implementation
const routeFiles = readdirSync('src/routes', { recursive: true, encoding: 'utf8' })
	.map((file) => `src/routes/${file.split(path.sep).join('/')}`)
	.filter((file) => /\.(svelte|ts)$/.test(file));
const importers = (feature: string) => routeFiles.filter((file) => readFileSync(file, 'utf8').includes(`#lib/features/${feature}/`));

const all = shots.map(({ name }) => name).sort();
const where = (pick: (shot: Shot) => boolean) => shots.filter(pick).map(({ name }) => name).sort();
const ofSpec = (spec: string) => where((shot) => shot.spec === spec);
const pick = (changed: string[], from: Shot[] = shots, imp = importers) => {
	const names = screenshotsFor(changed, from, imp);
	expect(new Set(names).size, 'no screenshot twice').toBe(names.length);
	return [...names].sort();
};

const today = ofSpec('e2e/today.e2e.ts');
const log = ofSpec('e2e/log.e2e.ts');
const week = ofSpec('e2e/week.e2e.ts');
const planDesktop = ofSpec('e2e/plan.desktop.e2e.ts');
const progressSpec = ofSpec('e2e/progress.e2e.ts');

it('the real fixture is what the brief describes', () => {
	expect(shots).toHaveLength(46);
	expect([today.length, log.length, week.length, planDesktop.length, progressSpec.length]).toEqual([12, 14, 2, 6, 12]);
	for (const shot of shots) {
		expect(shot.page, shot.name).toMatch(/^\/[^?#]*$/);
		expect(shot.spec, shot.name).toMatch(/^e2e\/[\w.-]+\.e2e\.ts$/);
	}
});

describe('changesRendering (the full suite still runs)', () => {
	it('skips e2e when nothing rendered changed', () => {
		expect(changesRendering(['scripts/canary.ts', '.github/workflows/ci.yml', 'src/routes/api/sync/+server.ts', 'src/lib/server/sync.ts', 'src/env.ts', 'src/lib/domain/plan.spec.ts', 'src/lib/domain/plan.test.ts'])).toBe(false);
	});

	it('runs e2e when a page, feature, shared UI, data, plan or e2e file changed', () => {
		for (const file of ['src/routes/+page.svelte', 'src/lib/features/log/steps.ts', 'src/lib/ui/tokens.css', 'data/curated/results.json', 'data/normalized/benchmarks.json', 'static/manifest.webmanifest', 'plan/week-01.json', 'e2e/test.ts', 'playwright.config.ts']) {
			expect(changesRendering([file]), file).toBe(true);
		}
	});

	// why: rules out tying "run e2e" to "some screenshot was picked" (#35 picks none but changes e2e/evidence.ts)
	it('real PRs: #33 and #35 run the suite, #27 and #28 do not', () => {
		expect(changesRendering(prFiles['33'])).toBe(true);
		expect(changesRendering(prFiles['35'])).toBe(true);
		expect(changesRendering(prFiles['27'])).toBe(false);
		expect(changesRendering(prFiles['28'])).toBe(false);
	});
});

describe('screenshotsFor: a changed route file', () => {
	// why: rules out prefix matching a +page (would add /progress/benchmarks and /progress/lifts/*), or filtering by spec (would drop the desktop one)
	it('a +page picks exactly the screenshots on its page, from any spec', () => {
		expect(pick(['src/routes/progress/+page.svelte'])).toEqual(['desktop-chromium-progress', 'mobile-chromium-progress', 'mobile-webkit-progress']);
		expect(pick(['src/routes/progress/+page.server.ts'])).toEqual(['desktop-chromium-progress', 'mobile-chromium-progress', 'mobile-webkit-progress']);
	});

	// why: rules out treating the root +page as app-wide, or "/" as a prefix of every page
	it('the root +page picks only the screenshots on /', () => {
		expect(pick(['src/routes/+page.svelte'])).toEqual(where((shot) => shot.page === '/'));
		expect(pick(['src/routes/+page.svelte'])).toHaveLength(17);
	});

	// why: rules out matching [param] literally (picks nothing), or letting it span segments or the bare parent
	it('[param] segments match any single value', () => {
		expect(pick(['src/routes/log/[date]/+page.svelte'])).toEqual(log);
		expect(pick(['src/routes/progress/benchmarks/[id]/+page.svelte'])).toEqual([
			'mobile-chromium-crossfit-total-history',
			'mobile-chromium-fran-history',
			'mobile-webkit-crossfit-total-history',
			'mobile-webkit-fran-history'
		]);
		const extra: Shot[] = [...shots, { name: 'x-deep', page: '/log/2027-01-25/edit', spec: 'e2e/log.e2e.ts' }, { name: 'x-bare', page: '/log', spec: 'e2e/log.e2e.ts' }];
		expect(pick(['src/routes/log/[date]/+page.svelte'], extra)).toEqual(log);
	});

	// why: rules out a nested +layout treated like a +page (only /progress), or a string prefix without a segment boundary (/progressive)
	it('a nested +layout covers its own page and every page under it', () => {
		const extra: Shot[] = [...shots, { name: 'x-progressive', page: '/progressive', spec: 'e2e/progress.e2e.ts' }];
		expect(pick(['src/routes/progress/+layout.svelte'], extra)).toEqual(where((shot) => shot.page === '/progress' || shot.page.startsWith('/progress/')));
		expect(pick(['src/routes/progress/+layout.svelte'], extra)).toHaveLength(13);
	});

	// why: rules out keeping a SvelteKit (group) segment in the route, which never appears in a URL
	it('a (group) segment is not part of the page', () => {
		expect(pick(['src/routes/(app)/week/+page.svelte'])).toEqual(week);
		expect(pick(['src/routes/(app)/+layout.svelte'])).toEqual(all);
	});

	// why: rules out falling back to every screenshot when a changed page has none
	it('a page with no screenshots picks none', () => {
		expect(pick(['src/routes/day/[date]/+page.svelte'])).toEqual([]);
		expect(pick(['src/routes/sync/+page.svelte'])).toEqual([]);
	});

	// why: rules out treating every file under src/routes as a route (layout-breakpoint.spec.ts sits beside the root +layout)
	it('server code and tests under src/routes pick none', () => {
		expect(pick(['src/routes/api/sync/+server.ts', 'src/routes/api/sync/sync.spec.ts', 'src/routes/layout-breakpoint.spec.ts'])).toEqual([]);
	});
});

describe('screenshotsFor: app-wide files pick every screenshot', () => {
	// why: rules out handling the root +layout as an ordinary route, or missing app.html / lib/ui
	it.each(['src/routes/+layout.svelte', 'src/routes/+layout.server.ts', 'src/app.html', 'src/lib/ui/tokens.css', 'src/lib/ui/TabBar.svelte'])('%s', (file) => {
		expect(pick([file])).toEqual(all);
	});
});

describe('screenshotsFor: a changed feature file', () => {
	// why: rules out ignoring the own-spec limit (/ also has plan and today screenshots, and the root +layout imports log)
	it('log: only log.e2e.ts screenshots, though the root +layout imports it', () => {
		expect(importers('log')).toContain('src/routes/+layout.svelte');
		expect(pick(['src/lib/features/log/steps.ts'])).toEqual(log);
	});

	// why: rules out picking every screenshot of the own spec regardless of route (plan.desktop also captures /progress)
	it('plan: its own desktop spec, only on the routes that import plan', () => {
		expect(pick(['src/lib/features/plan/Plan.svelte'])).toEqual(planDesktop.filter((name) => name !== 'desktop-chromium-progress'));
	});

	it('today: only today.e2e.ts screenshots on /, not the plan ones there', () => {
		expect(pick(['src/lib/features/today/prescription-lines.ts'])).toEqual(today);
	});

	// why: rules out picking by route only (plan.desktop's week-summary is on /, not /week, and must not come in either way)
	it('week and progress: their own specs', () => {
		expect(pick(['src/lib/features/week/Week.svelte'])).toEqual(week);
		expect(pick(['src/lib/features/progress/EvolutionChart.svelte'])).toEqual(progressSpec);
	});

	// why: rules out limiting to own spec when there is none (picks nothing), or ignoring the importers (picks all)
	it('a feature with no spec of its own picks every screenshot on the routes that import it', () => {
		const imp = (feature: string) => (feature === 'streak' ? ['src/routes/+page.svelte', 'src/routes/week/+page.svelte'] : []);
		expect(pick(['src/lib/features/streak/Streak.svelte'], shots, imp)).toEqual(where((shot) => shot.page === '/' || shot.page === '/week'));
	});

	// why: rules out matching the own spec by prefix or substring (planner.e2e.ts is not plan's)
	it("another spec whose name starts with the feature's is not its own", () => {
		const extra: Shot[] = [...shots, { name: 'x-planner', page: '/', spec: 'e2e/planner.e2e.ts' }];
		expect(pick(['src/lib/features/plan/Plan.svelte'], extra)).not.toContain('x-planner');
	});

	// why: rules out running a feature's tests through the feature rule
	it("a feature's own tests pick none", () => {
		expect(pick(['src/lib/features/log/flow.spec.ts'])).toEqual([]);
	});
});

describe('screenshotsFor: a changed e2e spec', () => {
	// why: rules out matching specs to screenshots by page or by name prefix (plan.desktop captures /progress too)
	it('picks exactly the screenshots it captures', () => {
		expect(pick(['e2e/plan.desktop.e2e.ts'])).toEqual(planDesktop);
		expect(pick(['e2e/plan.desktop.e2e.ts'])).toContain('desktop-chromium-progress');
		expect(pick(['e2e/week.e2e.ts'])).toEqual(week);
	});
});

describe('screenshotsFor: everything else picks none', () => {
	// why: rules out "anything rendered with no page of its own shows everything" (noise for the reviewer)
	it.each([
		'src/lib/domain/plan.ts',
		'src/lib/server/sync.ts',
		'src/env.ts',
		'data/curated/results.json',
		'data/normalized/benchmarks.json',
		'plan/week-01.json',
		'static/manifest.webmanifest',
		'e2e/test.ts',
		'e2e/evidence.ts',
		'e2e/clock.ts',
		'e2e/sync-env.spec.ts',
		'playwright.config.ts',
		'scripts/e2e-scope.ts',
		'.github/workflows/ci.yml',
		'verification.yaml'
	])('%s', (file) => {
		expect(pick([file])).toEqual([]);
	});
});

describe('screenshotsFor: real PRs', () => {
	// why: rules out dropping a rule when several kinds of change mix, or not deduplicating the union
	it('#33 (two specs, log/plan/today features, helpers, tests) picks its specs and log, not week or progress', () => {
		const picked = pick(prFiles['33']);
		expect(picked).toEqual([...new Set([...today, ...log, ...planDesktop])].sort());
		expect(picked).toHaveLength(32);
	});

	it.each(['27', '28', '35'])('#%s (scripts, server, helpers, tests) picks none', (pr) => {
		expect(pick(prFiles[pr])).toEqual([]);
	});

	it('order of the changed files does not matter', () => {
		expect(pick([...prFiles['33']].reverse())).toEqual(pick(prFiles['33']));
	});
});

describe('the CLI CI runs', () => {
	// why: rules out reading the wrong argument, ignoring the JSON beside the PNGs, or printing anything but one name per line
	it('reads changed files on stdin and the screenshots dir, prints the picked names', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'shots-'));
		try {
			for (const { name, ...meta } of shots) {
				writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(meta));
				writeFileSync(path.join(dir, `${name}.png`), '');
			}
			const run = (files: string[]) => spawnSync('node', ['scripts/e2e-scope.ts', '--screenshots', dir], { input: files.join('\n') + '\n', encoding: 'utf8' });
			const r33 = run(prFiles['33']);
			expect(r33.status).toBe(0);
			expect(r33.stdout.split('\n').filter(Boolean).sort()).toEqual([...new Set([...today, ...log, ...planDesktop])].sort());
			const r35 = run(prFiles['35']);
			expect(r35.status).toBe(0);
			expect(r35.stdout.trim()).toBe('');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
