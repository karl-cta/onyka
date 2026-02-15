ALTER TABLE `notes` ADD `is_sanctuary` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `sanctuary_pin_hash` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `sanctuary_iv` text;