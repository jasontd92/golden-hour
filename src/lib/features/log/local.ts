import { openLogStore, type LogStore } from './store.ts';

let opened: Promise<LogStore> | undefined;

export const localLog = (): Promise<LogStore> => (opened ??= openLogStore().catch((error: unknown) => {
	opened = undefined;
	throw error;
}));
