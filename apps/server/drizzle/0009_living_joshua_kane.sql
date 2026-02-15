ALTER TABLE `folders` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `folders_owner_parent_position_idx` ON `folders` (`owner_id`,`parent_id`,`position`);