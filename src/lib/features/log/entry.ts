import { v7 } from 'uuid';
import { LogEntry, SessionLog } from '#lib/domain/log.ts';

export type LoggedSet = Omit<LogEntry, 'id' | 'loggedAt' | 'deviceId'>;

export function newLogEntry(set: LoggedSet, deviceId: string, now = new Date()): LogEntry {
	return LogEntry.parse({ ...set, id: v7({ msecs: now.getTime() }), loggedAt: now.toISOString(), deviceId });
}

export type LoggedSession = Omit<SessionLog, 'kind' | 'id' | 'loggedAt' | 'deviceId'>;

export function newSessionLog(session: LoggedSession, deviceId: string, now = new Date()): SessionLog {
	return SessionLog.parse({ kind: 'session', ...session, id: v7({ msecs: now.getTime() }), loggedAt: now.toISOString(), deviceId });
}
