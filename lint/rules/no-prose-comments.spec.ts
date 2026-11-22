import { noProseComments } from './no-prose-comments.ts';
import { at, svelteTester, tsTester } from '../rule-tester.ts';

const file = at('src/lib/domain/plan.ts');
const component = at('src/lib/ui/Row.svelte');

tsTester.run('no-prose-comments', noProseComments, {
	valid: [
		{ filename: file, code: 'const a = 1;' },
		{ filename: file, code: '// why: Safari drops the first frame\nconst a = 1;' },
		{ filename: file, code: '/* why: keeps parity with build.py */\nconst a = 1;' },
		{ filename: file, code: '// @ts-expect-error zod widens the union here\nconst a: number = "x";' },
		{ filename: file, code: '// eslint-disable-next-line no-console -- CLI output\nconsole.log(1);' },
		{ filename: file, code: '// Stryker disable next-line all: Vite needs literal glob arguments\nconst a = 1;' }
	],
	invalid: [
		{ filename: file, code: '// increment the counter\nlet a = 1;', errors: [{ messageId: 'prose' }] },
		{ filename: file, code: '/** Returns the plan. */\nexport function plan() {}', errors: [{ messageId: 'prose' }] },
		{ filename: file, code: '// TODO later\nconst a = 1;', errors: [{ messageId: 'prose' }] },
		{ filename: file, code: '// @ts-expect-error\nconst a: number = "x";', errors: [{ messageId: 'tsNoReason' }] },
		{ filename: file, code: '// @ts-ignore\nconst a: number = "x";', errors: [{ messageId: 'tsIgnore' }] },
		{ filename: file, code: '/* eslint-disable no-console */\nconsole.log(1);', errors: [{ messageId: 'eslintNoReason' }] },
		{ filename: file, code: '// eslint-disable-next-line no-console\nconsole.log(1);', errors: [{ messageId: 'eslintNoReason' }] },
		{ filename: file, code: '// Stryker disable next-line all\nconst a = 1;', errors: [{ messageId: 'strykerNoReason' }] },
		{ filename: file, code: '// Stryker disable all: whole file\nconst a = 1;', errors: [{ messageId: 'strykerNoReason' }] }
	]
});

svelteTester.run('no-prose-comments (svelte)', noProseComments, {
	valid: [
		{ filename: component, code: '<script lang="ts">\n\tlet a = 1;\n</script>\n\n<p>{a}</p>' },
		{ filename: component, code: '<!-- svelte-ignore a11y_autofocus -->\n<input autofocus />' }
	],
	invalid: [
		{ filename: component, code: '<script lang="ts">\n\t// the count\n\tlet a = 1;\n</script>\n\n<p>{a}</p>', errors: [{ messageId: 'prose' }] },
		{ filename: component, code: '<!-- the header -->\n<h1>Today</h1>', errors: [{ messageId: 'prose' }] }
	]
});
