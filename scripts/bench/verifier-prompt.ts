export interface ChunkBrief {
	chunk: string;
	clone: string;
	baseSha: string;
	headSha: string;
	changes: { title: string; claims: string[] }[];
}

export const builtInMethod = `# Method for verifiers

You are a fresh verifier and you are read-only toward the real repository. You did not implement this chunk and have no stake in it.

## Rules
- Work only in the clone named below. It is already disposable and installed. Mutations that prove a test catches something are allowed there; revert them afterwards.
- Reproduce, don't trust. "The EM said X" is not evidence. Run the command and compare the output.
- Classify each claim: mechanical (needs a command and its output), empirical (needs a test or a live result), judgment (goes to HUMAN; you don't tick it).
- Tick-on-vibes is forbidden. Use FAILED or UNVERIFIABLE with a reason. Report claims that did NOT hold.
- If .sprint/tracker.md exists, read its §2 for the durable rules the code must hold. team/draft-plan.md is the methodology the plan must follow.
- There is no GitHub remote and no CI for this chunk. Never push, and do not call gh.
- Playwright browsers may not be installed. If e2e can't run, read the e2e specs and say so.

## Verdict format
\`\`\`
VERIFIER: <chunk> — <PASS | FAIL | PASS WITH GAPS>
criteria met:   <n>/<total>
  - <claim> → <evidence checked; reproduced or not>
criteria FAILED:      <list, or none>
criteria HUMAN:       <judgment calls>
UNVERIFIABLE:         <with why>
claims that did NOT hold: <list, or none>
\`\`\``;

export function verifierPrompt(brief: ChunkBrief, method: string = builtInMethod): string {
	const changes = brief.changes
		.map((change) => [`- ${change.title}`, ...change.claims.map((claim) => `  - the EM claims: ${claim}`)].join('\n'))
		.join('\n');
	return `${method}

# Your chunk: ${brief.chunk}
Clone: ${brief.clone}
Review the commits ${brief.baseSha}..${brief.headSha} (\`git log --stat ${brief.baseSha}..HEAD\`, \`git diff ${brief.baseSha} HEAD\`). Judge whether the change is correct and whether every rule it touches still holds, not only whether the claims are true.

## Claims to test, not trust
${changes}

## This is a seeded-bug benchmark
This chunk may contain deliberately planted bugs, or none. You are not told how many or what kind. Look for them the way you would look for any defect: by reading the diff against the code and the rules around it, and by proving suspicions in the clone.

## Findings block (required, scored by a script)
After the verdict, end your reply with one fenced json block that lists every defect, gap or claim that did not hold, one entry each:
\`\`\`json
{"findings": [{"file": "src/path/to/file.ts", "line": 42, "behavior": "what is wrong and what it breaks"}]}
\`\`\`
Name the repo-relative file and line where the defect lives whenever you can. An entry with no file must name the exact function or behavior. A vague "something is off" scores nothing. Use {"findings": []} if you found none.`;
}
