CREATE TABLE `session_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_date` text NOT NULL,
	`rpe` integer NOT NULL,
	`score_block_index` integer,
	`score_prescription_index` integer,
	`score_type` text,
	`score_value` real,
	`note` text,
	`logged_at` text NOT NULL,
	`device_id` text NOT NULL,
	`revision` integer NOT NULL,
	`deleted_at` text,
	`received_at` text NOT NULL
);
