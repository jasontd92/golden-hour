import { layerBoundaries } from './layer-boundaries.ts';
import { at, tsTester } from '../rule-tester.ts';

const domain = at('src/lib/domain/plan.ts');
const domainSpec = at('src/lib/domain/plan.spec.ts');
const today = at('src/lib/features/today/model.ts');

tsTester.run('layer-boundaries', layerBoundaries, {
	valid: [
		{ filename: domain, code: "import { x } from './units.ts';" },
		{ filename: domain, code: "import { z } from 'zod';" },
		{ filename: domain, code: "import { z } from 'zod/mini';" },
		{ filename: domain, code: "import { x } from '#lib/domain/units.ts';" },
		{ filename: domainSpec, code: "import { readFileSync } from 'node:fs';" },
		{ filename: domainSpec, code: "import lifts from '../../../data/normalized/lifts.json';" },
		{ filename: today, code: "import { x } from '#lib/domain/plan.ts';" },
		{ filename: today, code: "import { x } from './view.ts';" },
		{ filename: today, code: "import Row from '#lib/ui/Row.svelte';" },
		{ filename: at('src/routes/+page.server.ts'), code: "import { db } from '#lib/server/db.ts';" },
		{ filename: at('src/routes/api/+server.ts'), code: "import { db } from '$lib/server/db.ts';" },
		{ filename: at('src/hooks.server.ts'), code: "import { db } from '#lib/server/db.ts';" },
		{ filename: at('src/lib/server/sync.ts'), code: "import { db } from './db.ts';" }
	],
	invalid: [
		{ filename: domain, code: "import { x } from '#lib/features/today/model.ts';", errors: [{ messageId: 'domainImport' }] },
		{ filename: domain, code: "import { x } from '../features/today/model.ts';", errors: [{ messageId: 'domainImport' }] },
		{ filename: domain, code: "import { x } from '$lib/ui/Row.svelte';", errors: [{ messageId: 'domainImport' }] },
		{ filename: domain, code: "export * from '../server/db.ts';", errors: [{ messageId: 'domainImport' }] },
		{ filename: domain, code: "const m = import('../../routes/x.ts');", errors: [{ messageId: 'domainImport' }] },
		{ filename: domain, code: "import { writable } from 'svelte/store';", errors: [{ messageId: 'domainFramework' }] },
		{ filename: domain, code: "import { browser } from '$app/environment';", errors: [{ messageId: 'domainFramework' }] },
		{ filename: domain, code: "import { readFileSync } from 'node:fs';", errors: [{ messageId: 'domainPackage' }] },
		{ filename: domain, code: "import { v7 } from 'uuid';", errors: [{ messageId: 'domainPackage' }] },
		{ filename: domain, code: "import { zodish } from 'zodish';", errors: [{ messageId: 'domainPackage' }] },
		{ filename: domain, code: "import movements from '../../../data/curated/movements.json';", errors: [{ messageId: 'domainOutside' }] },
		{ filename: domain, code: "import { x } from '#lib/other/x.ts';", errors: [{ messageId: 'domainOutside' }] },
		{ filename: domainSpec, code: "import { x } from '#lib/features/today/model.ts';", errors: [{ messageId: 'domainImport' }] },
		{ filename: today, code: "import { x } from '#lib/features/week/model.ts';", errors: [{ messageId: 'crossFeature' }] },
		{ filename: today, code: "export { x } from '../week/model.ts';", errors: [{ messageId: 'crossFeature' }] },
		{ filename: today, code: "import { db } from '#lib/server/db.ts';", errors: [{ messageId: 'serverFromClient' }] },
		{ filename: at('src/routes/+page.ts'), code: "import { db } from '$lib/server/db.ts';", errors: [{ messageId: 'serverFromClient' }] },
		{ filename: at('src/lib/ui/Row.ts'), code: "import { db } from '../server/db.ts';", errors: [{ messageId: 'serverFromClient' }] }
	]
});
