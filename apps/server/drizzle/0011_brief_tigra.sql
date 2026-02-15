ALTER TABLE `notes` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `notes_folder_position_idx` ON `notes` (`folder_id`,`position`);