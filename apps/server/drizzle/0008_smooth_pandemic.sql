CREATE TABLE `thoughts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`content` text NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`is_expired` integer DEFAULT false NOT NULL,
	`converted_to_note_id` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`converted_to_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `thoughts_owner_idx` ON `thoughts` (`owner_id`);--> statement-breakpoint
CREATE INDEX `thoughts_expires_at_idx` ON `thoughts` (`expires_at`);--> statement-breakpoint
CREATE INDEX `thoughts_owner_pinned_idx` ON `thoughts` (`owner_id`,`is_pinned`);