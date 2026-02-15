CREATE TABLE `note_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `note_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_comments_note_idx` ON `note_comments` (`note_id`);--> statement-breakpoint
CREATE INDEX `note_comments_user_idx` ON `note_comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `note_comments_parent_idx` ON `note_comments` (`parent_id`);