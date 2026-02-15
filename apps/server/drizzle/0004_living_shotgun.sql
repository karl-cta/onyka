CREATE TABLE `weekly_recaps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`week_end` text NOT NULL,
	`words_written` integer DEFAULT 0 NOT NULL,
	`notes_created` integer DEFAULT 0 NOT NULL,
	`notes_edited` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`is_shown` integer DEFAULT false NOT NULL,
	`shown_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_recaps_user_idx` ON `weekly_recaps` (`user_id`);--> statement-breakpoint
CREATE INDEX `weekly_recaps_week_idx` ON `weekly_recaps` (`week_start`);--> statement-breakpoint
CREATE INDEX `weekly_recaps_user_week_idx` ON `weekly_recaps` (`user_id`,`week_start`);