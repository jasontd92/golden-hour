import { v7 } from 'uuid';
import { LogEntry } from '#lib/domain/log.ts';

export type LoggedSet = Omit<LogEntry, 'id' | 'loggedAt' | 'deviceId'>;

export function newLogEntry(set: LoggedSet, deviceId: string, now = new Date()): LogEntry {
	return LogEntry.parse({ ...set, id: v7({ msecs: now.getTime() }), loggedAt: now.toISOString(), deviceId });
}
