import type { AST, Rule } from 'eslint';

type Verdict = 'ok' | 'prose' | 'tsNoReason' | 'tsIgnore' | 'eslintNoReason';

const allowed = [
	/^why:\s*\S/,
	/^@ts-expect-error\s+\S/,
	/^eslint-disable-next-line\s+\S+.*\s--\s+\S/,
	/^svelte-ignore\s+\S/
];

export function judgeComment(raw: string): Verdict {
	const text = raw.replace(/^\*+/, '').trim();
	if (allowed.some((pattern) => pattern.test(text))) return 'ok';
	if (text.startsWith('@ts-expect-error')) return 'tsNoReason';
	if (/^@ts-(ignore|nocheck)/.test(text)) return 'tsIgnore';
	if (/^eslint-disable/.test(text)) return 'eslintNoReason';
	return 'prose';
}

interface HtmlComment {
	type: 'SvelteHTMLComment';
	value: string;
	loc: AST.SourceLocation;
}

export const noProseComments: Rule.RuleModule = {
	meta: {
		type: 'suggestion',
		schema: [],
		messages: {
			prose:
				"Comments are banned: code documents itself through names and directories. Rename or extract a function instead; for non-obvious intent only, prefix with 'why:'.",
			tsNoReason: "@ts-expect-error needs a reason: '@ts-expect-error <why>'.",
			tsIgnore: "Use '@ts-expect-error <why>' instead of @ts-ignore or @ts-nocheck.",
			eslintNoReason:
				"Only 'eslint-disable-next-line <rule> -- <why>' is allowed. Fix the code, or disable one line with the rule name and a reason."
		}
	},
	create(context) {
		function judge(value: string, loc: AST.SourceLocation) {
			const verdict = judgeComment(value);
			if (verdict !== 'ok') context.report({ loc, messageId: verdict });
		}

		return {
			Program() {
				for (const comment of context.sourceCode.getAllComments()) {
					if (comment.loc) judge(comment.value, comment.loc);
				}
			},
			SvelteHTMLComment(node: unknown) {
				const comment = node as HtmlComment;
				judge(comment.value, comment.loc);
			}
		};
	}
};
