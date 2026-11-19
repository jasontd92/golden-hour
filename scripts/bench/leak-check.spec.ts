import { describe, expect, it } from 'vitest';
import { catalog } from './catalog.ts';
import { leaks, repoLeaks, verifierFacing } from './leak-check.ts';
import { builtInMethod, verifierPrompt } from './verifier-prompt.ts';

const target = catalog[0]!;

describe('verifier prompts stay blind to the catalog', () => {
	it('flags a class id as a whole token', () => {
		expect(leaks('brief.md', `watch for ${target.id} here`)).toHaveLength(1);
		expect(leaks('brief.md', `x-${target.id}-y`)).toEqual([]);
	});

	it('flags a description whatever its case, wrapping or punctuation', () => {
		const rewrapped = target.description.toUpperCase().replace(/ /g, '\n  ').replace(/,/g, ' ;');
		expect(leaks('brief.md', `Intro. ${rewrapped} Outro.`)[0]).toContain(`the description of '${target.id}'`);
	});

	it('scans only verifier-facing files in the repo', () => {
		const read = () => `mentions ${target.id}`;
		expect(verifierFacing).toContain('.claude/**');
		expect(repoLeaks(['.claude/agents/verifier.md', 'scripts/bench/catalog.ts', 'README.md'], read)).toHaveLength(1);
		expect(repoLeaks(['scripts/bench/verifier-prompt.ts'], read)).toHaveLength(1);
		expect(repoLeaks(['scripts/bench/catalog.ts'], read)).toEqual([]);
	});

	it('the built-in method and an assembled prompt are clean', () => {
		expect(leaks('method', builtInMethod)).toEqual([]);
		const prompt = verifierPrompt({
			chunk: 'BENCH-1',
			clone: '/tmp/clone',
			baseSha: 'a'.repeat(40),
			headSha: 'b'.repeat(40),
			changes: [{ title: 'refactor(log): tidy sync outcomes', claims: ['no behaviour change'] }]
		});
		expect(leaks('prompt', prompt)).toEqual([]);
		expect(prompt).toContain('may contain deliberately planted bugs');
		expect(prompt).toContain('the EM claims: no behaviour change');
	});
});
