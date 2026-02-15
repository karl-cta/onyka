-- Create uploads table for ownership tracking
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_filename_unique` ON `uploads` (`filename`);--> statement-breakpoint
CREATE INDEX `uploads_owner_idx` ON `uploads` (`owner_id`);--> statement-breakpoint
CREATE INDEX `uploads_filename_idx` ON `uploads` (`filename`);
