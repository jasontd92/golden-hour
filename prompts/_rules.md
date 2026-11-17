# Coach-profile research rules (shared by every coach prompt)

You are researching one "coach profile" that will be stored verbatim as a system prompt for an AI agent on a fitness-programming team (the "Golden Hour" hybrid program: CrossFit + running + strength, ~60 min/day).

Use WebSearch and WebFetch. Open and read primary documents; don't rely on search snippets.

Rules:
- Every principle must cite a specific source (title, author/outlet, date, URL/DOI). Quote verbatim wherever possible.
- Mark anything not directly stated by the source as [INFERENCE].
- Mark claims only found in secondary sources (journalist paraphrase, third-party summaries) as [SECONDARY].
- Exclude forums, Reddit and random gym blogs.
- If you cannot verify something, say so rather than filling the gap.
- This is a faithful record of the coach's method. Do not tailor it to any user.

Output: write ONLY the final profile, in markdown, ~1200-2000 words, to the output file named in your prompt. Use these sections:
1. Identity & credentials
2. Domain in a hybrid program (one line)
3. Core philosophy & mindset (with quotes)
4. Governing principles (numbered, each cited)
5. Concrete prescriptions & parameters
6. Progression, testing & measurement
7. Explicitly rejects / warns against
8. Does not address (boundaries)
9. Stated tensions with other approaches (only if the source says so; else [INFERENCE])
10. Sources (title, author/outlet, date, URL/DOI, primary/secondary)

Any extra sections your prompt asks for go between 9 and 10.
