import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { changesRendering, screenshotsFor, type Shot } from './e2e-scope.ts';

// why: the 46 screenshots, with the {page, spec} that captureEvidence wrote beside them, from PR #35's CI artifact (run 44990626336)
const shots: Shot[] = JSON.parse(readFileSync('scripts/fixtures/e2e-scope/shots-35.json', 'utf8'));
// why: real gh pr view <n> --json files lists from jasontd92/golden-hour
const prFileLists: Record<string, string[]> = JSON.parse(readFileSync('scripts/fixtures/e2e-scope/pr-files.json', 'utf8'));
const prFiles = (pr: string): string[] => {
	const files = prFileLists[pr];
	if (!files) throw new Error(`no fixture file list for #${pr}`);
	return files;
};

// why: the real importers, read from src/routes on its own rather than borrowed from the implementation; an index import ('#lib/features/log') counts too
const routeFiles = readdirSync('src/routes', { recursive: true, encoding: 'utf8' })
	.map((file) => `src/routes/${file.split(path.sep).join('/')}`)
	.filter((file) => /\.(svelte|ts)$/.test(file));
const importers = (feature: string) => routeFiles.filter((file) => new RegExp(`#lib/features/${feature}(/|['"])`).test(readFileSync(file, 'utf8')));
// why: the repo's real e2e spec files, the 4th argument CI passes
const specs = readdirSync('e2e').filter((file) => file.endsWith('.e2e.ts')).map((file) => `e2e/${file}`);

const all = shots.map(({ name }) => name).sort();
const where = (pick: (shot: Shot) => boolean, from: Shot[] = shots) => from.filter(pick).map(({ name }) => name).sort();
const ofSpec = (spec: string) => where((shot) => shot.spec === spec);
const pick = (changed: string[], from: Shot[] = shots, imp = importers, specFiles = specs) => {
	const names = screenshotsFor(changed, from, imp, specFiles);
	expect(new Set(names).size, 'no screenshot twice').toBe(names.length);
	return [...names].sort();
};
const without = (spec: string) => shots.filter((shot) => shot.spec !== spec);

const today = ofSpec('e2e/today.e2e.ts');
const log = ofSpec('e2e/log.e2e.ts');
const week = ofSpec('e2e/week.e2e.ts');
const planDesktop = ofSpec('e2e/plan.desktop.e2e.ts');
const progressSpec = ofSpec('e2e/progress.e2e.ts');

it('the real fixture is what the brief describes', () => {
	expect(specs).toEqual(expect.arrayContaining(['e2e/log.e2e.ts', 'e2e/today.e2e.ts', 'e2e/week.e2e.ts', 'e2e/plan.desktop.e2e.ts', 'e2e/progress.e2e.ts']));
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
		expect(changesRendering(prFiles('33'))).toBe(true);
		expect(changesRendering(prFiles('35'))).toBe(true);
		expect(changesRendering(prFiles('27'))).toBe(false);
		expect(changesRendering(prFiles('28'))).toBe(false);
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

	// why: rules out deciding "has its own spec" from the screenshots, not the spec files: log.e2e.ts captured nothing, the root +layout imports log, so all 46 went out
	it('log changed and log.e2e.ts captured nothing: picks none, not all 46', () => {
		expect(importers('log')).toContain('src/routes/+layout.svelte');
		expect(pick(['src/lib/features/log/steps.ts'], without('e2e/log.e2e.ts'))).toEqual([]);
	});

	it('plan changed and plan.desktop.e2e.ts captured nothing: picks none, not the / screenshots of today', () => {
		expect(pick(['src/lib/features/plan/Plan.svelte'], without('e2e/plan.desktop.e2e.ts'))).toEqual([]);
	});

	// why: rules out ignoring the 4th argument (streak has no screenshots of its own spec, but its spec file exists)
	it('a feature whose spec file exists but captured nothing picks none', () => {
		const imp = (feature: string) => (feature === 'streak' ? ['src/routes/+page.svelte'] : []);
		expect(pick(['src/lib/features/streak/Streak.svelte'], shots, imp, [...specs, 'e2e/streak.e2e.ts'])).toEqual([]);
		expect(pick(['src/lib/features/streak/Streak.svelte'], shots, imp, [...specs, 'e2e/streak.desktop.e2e.ts'])).toEqual([]);
	});

	// why: rules out matching the own spec file by prefix (streaky.e2e.ts is not streak's), which would wrongly pick none
	it("a spec file whose name only starts with the feature's does not count as its own", () => {
		const imp = (feature: string) => (feature === 'streak' ? ['src/routes/week/+page.svelte'] : []);
		expect(pick(['src/lib/features/streak/Streak.svelte'], shots, imp, [...specs, 'e2e/streaky.e2e.ts', 'e2e/streak-old.e2e.ts'])).toEqual(week);
	});

	// why: rules out a spec that captured something still being filtered by the spec list (own spec present in both)
	it('the own spec captured some screenshots: only those, on the importing routes', () => {
		const someLog = shots.filter((shot) => shot.spec === 'e2e/log.e2e.ts').slice(0, 3);
		const from = [...without('e2e/log.e2e.ts'), ...someLog];
		expect(pick(['src/lib/features/log/steps.ts'], from)).toEqual(someLog.map(({ name }) => name).sort());
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
		const picked = pick(prFiles('33'));
		expect(picked).toEqual([...new Set([...today, ...log, ...planDesktop])].sort());
		expect(picked).toHaveLength(32);
	});

	it.each(['27', '28', '35'])('#%s (scripts, server, helpers, tests) picks none', (pr) => {
		expect(pick(prFiles(pr))).toEqual([]);
	});

	it('order of the changed files does not matter', () => {
		expect(pick([...prFiles('33')].reverse())).toEqual(pick(prFiles('33')));
	});
});

const writeShots = (dir: string, from: Shot[]) => {
	mkdirSync(dir, { recursive: true });
	for (const { name, ...meta } of from) {
		writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(meta));
		writeFileSync(path.join(dir, `${name}.png`), '');
	}
};
const withTmp = <T>(fn: (dir: string) => T): T => {
	const dir = mkdtempSync(path.join(tmpdir(), 'e2e-scope-'));
	try {
		return fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};
const cli = path.resolve('scripts/e2e-scope.ts');
const runCli = (files: string[], shotsDir: string, cwd = process.cwd()) =>
	spawnSync('node', [cli, '--screenshots', shotsDir], { cwd, input: files.join('\n') + '\n', encoding: 'utf8' });
const lines = (out: string) => out.split('\n').filter(Boolean).sort();

describe('the CLI CI runs', () => {
	// why: rules out reading the wrong argument, ignoring the JSON beside the PNGs, or printing anything but one name per line
	it('reads changed files on stdin and the screenshots dir, prints the picked names', () =>
		withTmp((dir) => {
			writeShots(dir, shots);
			const r33 = runCli(prFiles('33'), dir);
			expect(r33.status).toBe(0);
			expect(lines(r33.stdout)).toEqual([...new Set([...today, ...log, ...planDesktop])].sort());
			const r35 = runCli(prFiles('35'), dir);
			expect(r35.status).toBe(0);
			expect(r35.stdout.trim()).toBe('');
		}));

	// why: rules out the CLI not passing the repo's e2e spec files (falling back to the specs seen in the screenshots), which published all 46 for a log change
	it("passes the repo's spec files: a log change when log.e2e.ts captured nothing prints nothing", () =>
		withTmp((dir) => {
			writeShots(dir, without('e2e/log.e2e.ts'));
			const run = runCli(['src/lib/features/log/steps.ts'], dir);
			expect(run.status).toBe(0);
			expect(run.stdout.trim()).toBe('');
		}));

	// why: rules out matching only '#lib/features/<f>/' (misses an index import), or '#lib/features/<f>' with no boundary (streaky would count as streak)
	it('a route imports a feature through its index or a file in it, not through a feature whose name starts the same', () =>
		withTmp((dir) => {
			const files: Record<string, string> = {
				'src/routes/+page.svelte': `<script>\n\timport { Streak } from '#lib/features/streak';\n</script>\n`,
				'src/routes/week/+page.svelte': `<script>\n\timport Streak from "#lib/features/streak/Streak.svelte";\n</script>\n`,
				'src/routes/progress/+page.svelte': `<script>\n\timport { a } from '#lib/features/streaky';\n\timport B from '#lib/features/streaky/B.svelte';\n\timport C from '#lib/features/streak-old/C.svelte';\n</script>\n`,
				'src/routes/log/[date]/+page.ts': `export { load } from '#lib/features/other';\n`,
				'e2e/test.ts': ''
			};
			for (const [file, text] of Object.entries(files)) {
				mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
				writeFileSync(path.join(dir, file), text);
			}
			const from: Shot[] = [
				{ name: 'home', page: '/', spec: 'e2e/x.e2e.ts' },
				{ name: 'week', page: '/week', spec: 'e2e/x.e2e.ts' },
				{ name: 'progress', page: '/progress', spec: 'e2e/x.e2e.ts' },
				{ name: 'log', page: '/log/2027-01-25', spec: 'e2e/x.e2e.ts' }
			];
			writeShots(path.join(dir, 'shots'), from);
			const run = runCli(['src/lib/features/streak/Streak.svelte'], 'shots', dir);
			expect(run.stderr).toBe('');
			expect(lines(run.stdout)).toEqual(['home', 'week']);
			expect(lines(runCli(['src/lib/features/streaky/index.ts'], 'shots', dir).stdout)).toEqual(['progress']);
		}));
});

// why: the evidence job is shell in YAML; its steps run here against a fake gh that records what it was asked to do
const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
	jobs: Record<string, { steps: { id?: string; name?: string; if?: string; run?: string }[] }>;
};
const evidenceJob = ci.jobs['evidence'];
const step = (pick: (s: { id?: string; name?: string }) => boolean) => {
	const found = evidenceJob?.steps.find(pick);
	if (!found?.run) throw new Error('evidence step not found');
	return found;
};
const fakeGh = `#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG"
for a in "$@"; do case "$a" in body=@*) cp "\${a#body=@}" "$GH_LOG.body" ;; esac; done
case "$*" in
	*/compare/*) cat "$GH_FILES" ;;
	*--paginate*) printf '%s' "$GH_EXISTING_ID" ;;
esac
`;
const runStep = (script: string, dir: string, env: Record<string, string>) => {
	const bin = path.join(dir, 'bin');
	mkdirSync(bin, { recursive: true });
	writeFileSync(path.join(bin, 'gh'), fakeGh);
	chmodSync(path.join(bin, 'gh'), 0o755);
	const log = path.join(dir, 'gh.log');
	const run = spawnSync('bash', ['-e', '-c', script], {
		cwd: dir,
		encoding: 'utf8',
		env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GH_LOG: log, GITHUB_REPOSITORY: 'jasontd92/golden-hour', PR: '35', SHA: 'abcdef0123456789', BASE: 'base0123', E2E_RESULT: 'success', ...env }
	});
	const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
	const body = existsSync(`${log}.body`) ? readFileSync(`${log}.body`, 'utf8') : undefined;
	return { run, calls, body };
};

describe('the CI evidence job', () => {
	const pickStep = step((s) => s.id === 'pick');
	const commentStep = step((s) => /comment/i.test(s.name ?? ''));

	// why: rules out taking the changed files from the PR's live file list (which can be ahead of the commit whose screenshots these are)
	it.each([
		['33', 32],
		['35', 0]
	])('picks from compare(base...head) of the commit: #%s gives count=%i', (pr, count) =>
		withTmp((dir) => {
			for (const link of ['scripts', 'src', 'e2e']) symlinkSync(path.resolve(link), path.join(dir, link));
			writeShots(path.join(dir, 'shots'), shots);
			writeFileSync(path.join(dir, 'files.txt'), prFiles(pr).join('\n') + '\n');
			writeFileSync(path.join(dir, 'out.txt'), '');
			const { run, calls } = runStep(pickStep.run ?? '', dir, { GH_FILES: path.join(dir, 'files.txt'), GITHUB_OUTPUT: path.join(dir, 'out.txt') });
			expect(run.status, run.stderr).toBe(0);
			expect(calls).toHaveLength(1);
			expect(calls[0]).toContain('repos/jasontd92/golden-hour/compare/base0123...abcdef0123456789');
			expect(readFileSync(path.join(dir, 'out.txt'), 'utf8')).toContain(`count=${count}\n`);
		})
	);

	// why: rules out publishing (or making an empty ci-evidence commit) when nothing was picked
	it('publishes to ci-evidence only when something was picked', () => {
		expect(step((s) => /publish/i.test(s.name ?? '')).if).toBe("steps.pick.outputs.count != '0'");
	});

	const comment = (count: string, picked: string[], existingId: string) =>
		withTmp((dir) => {
			writeFileSync(path.join(dir, 'picked.txt'), picked.map((name) => `${name}\n`).join(''));
			return runStep(commentStep.run ?? '', dir, { COUNT: count, GH_EXISTING_ID: existingId });
		});
	const writes = (calls: string[]) => calls.filter((call) => !call.includes('--paginate'));

	// why: rules out leaving the earlier comment's screenshots up after a commit that touched no pages, or posting a fresh empty one
	it('nothing picked and an earlier comment: updates it to say this commit touched no pages with screenshots', () => {
		const { run, calls, body } = comment('0', [], '4242');
		expect(run.status, run.stderr).toBe(0);
		expect(writes(calls)).toHaveLength(1);
		expect(writes(calls)[0]).toMatch(/-X PATCH repos\/jasontd92\/golden-hour\/issues\/comments\/4242 /);
		expect(body?.startsWith('<!-- e2e-screenshots -->')).toBe(true);
		expect(body).toContain('abcdef0');
		expect(body).toContain('touched no pages with screenshots');
		expect(body).not.toContain('<img');
	});

	it('nothing picked and no earlier comment: posts nothing', () => {
		const { run, calls, body } = comment('0', [], '');
		expect(run.status, run.stderr).toBe(0);
		expect(writes(calls)).toEqual([]);
		expect(body).toBeUndefined();
	});

	it('screenshots picked: posts (or updates) a comment showing each inline from ci-evidence', () => {
		const posted = comment('2', ['mobile-chromium-week', 'mobile-webkit-week'], '');
		expect(posted.run.status, posted.run.stderr).toBe(0);
		expect(writes(posted.calls)).toHaveLength(1);
		expect(writes(posted.calls)[0]).toMatch(/^api repos\/jasontd92\/golden-hour\/issues\/35\/comments /);
		expect(posted.body?.startsWith('<!-- e2e-screenshots -->')).toBe(true);
		expect(posted.body).not.toContain('touched no pages');
		for (const name of ['mobile-chromium-week', 'mobile-webkit-week']) {
			expect(posted.body).toContain(`https://github.com/jasontd92/golden-hour/blob/ci-evidence/35/abcdef0123456789/${name}.png?raw=true`);
		}
		const updated = comment('2', ['mobile-chromium-week', 'mobile-webkit-week'], '4242');
		expect(writes(updated.calls)[0]).toMatch(/-X PATCH repos\/jasontd92\/golden-hour\/issues\/comments\/4242 /);
	});

	// why: rules out linking the artifact zip, which needs a login and a download instead of showing the screenshots
	it('never links a zip, in the comment or anywhere in the job', () => {
		expect(JSON.stringify(evidenceJob)).not.toMatch(/zip/i);
		expect(comment('0', [], '4242').body).not.toMatch(/zip|artifacts\//i);
		expect(comment('1', ['mobile-chromium-week'], '').body).not.toMatch(/zip|artifacts\//i);
	});
});
