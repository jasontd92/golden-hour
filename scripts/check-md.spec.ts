import { describe, expect, it } from 'vitest';
import { markdownProblems } from './check-md.ts';

describe('check-md', () => {
	it('passes allowlisted markdown', () => {
		expect(
			markdownProblems(['README.md', 'data/README.md', 'team/positions/bare.md', '.sprint/tracker.md', 'src/app.html'])
		).toEqual([]);
	});
	it('fails stray markdown and states the policy', () => {
		const problems = markdownProblems(['foo.md', 'src/lib/domain/NOTES.md', 'data/raw/notes.md', 'docs/x.MDX']);
		expect(problems).toHaveLength(4);
		expect(problems[0]).toMatch(/^foo\.md: markdown is allowed only in README\.md.*lint rule or test/);
	});
});
