import type { z } from 'zod';

export function lastJsonBlock<T>(text: string, schema: z.ZodType<T>): T | null {
	const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)].map((match) => match[1]!);
	for (const block of blocks.reverse()) {
		try {
			const parsed = schema.safeParse(JSON.parse(block));
			if (parsed.success) return parsed.data;
		} catch {
			continue;
		}
	}
	return null;
}
