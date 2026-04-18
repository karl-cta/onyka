CREATE TABLE `note_uploads` (
	`note_id` text NOT NULL,
	`filename` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filename`) REFERENCES `uploads`(`filename`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `note_uploads_pk` ON `note_uploads` (`note_id`,`filename`);--> statement-breakpoint
CREATE INDEX `note_uploads_filename_idx` ON `note_uploads` (`filename`);
