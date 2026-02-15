CREATE TABLE `note_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`title` text DEFAULT 'Page 1' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`mode` text DEFAULT 'text' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_pages_note_idx` ON `note_pages` (`note_id`);
--> statement-breakpoint
CREATE INDEX `note_pages_position_idx` ON `note_pages` (`note_id`,`position`);
