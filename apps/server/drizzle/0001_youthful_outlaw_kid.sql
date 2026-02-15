ALTER TABLE `notes` ADD `icon` text DEFAULT 'FileText' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `is_quick_note` integer DEFAULT false NOT NULL;