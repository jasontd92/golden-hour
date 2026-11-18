CREATE TABLE `log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_date` text NOT NULL,
	`block_index` integer NOT NULL,
	`prescription_index` integer NOT NULL,
	`set_index` integer NOT NULL,
	`movement` text NOT NULL,
	`load` real,
	`reps` integer NOT NULL,
	`rpe` real,
	`note` text,
	`logged_at` text NOT NULL,
	`device_id` text NOT NULL,
	`revision` integer NOT NULL,
	`deleted_at` text,
	`received_at` text NOT NULL
);
