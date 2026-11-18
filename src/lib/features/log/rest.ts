import { z } from 'zod';

export const restSeconds = 90;

export const wallClock = (): Date => new Date();

const restKey = 'golden-hour.rest';

export const Rest = z.strictObject({ sessionDate: z.iso.date(), entryId: z.string(), endsAt: z.number() });
export type Rest = z.infer<typeof Rest>;

export function rememberedRest(storage: Storage = localStorage): Rest | undefined {
	try {
		return Rest.parse(JSON.parse(storage.getItem(restKey) ?? 'null'));
	} catch {
		return undefined;
	}
}

export function rememberRest(rest: Rest | undefined, storage: Storage = localStorage): void {
	if (rest) storage.setItem(restKey, JSON.stringify(rest));
	else storage.removeItem(restKey);
}

export const restLeftSeconds = (endsAt: number, now: number) => Math.max(0, Math.ceil((endsAt - now) / 1000));

export const formatRest = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
