import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const logEntries = sqliteTable('log_entries', {
	id: text('id').primaryKey(),
	sessionDate: text('session_date').notNull(),
	blockIndex: integer('block_index').notNull(),
	prescriptionIndex: integer('prescription_index').notNull(),
	setIndex: integer('set_index').notNull(),
	movement: text('movement').notNull(),
	load: real('load'),
	reps: integer('reps').notNull(),
	rpe: real('rpe'),
	note: text('note'),
	loggedAt: text('logged_at').notNull(),
	deviceId: text('device_id').notNull(),
	revision: integer('revision').notNull(),
	deletedAt: text('deleted_at'),
	receivedAt: text('received_at').notNull()
});

export type LogEntryRow = typeof logEntries.$inferSelect;
