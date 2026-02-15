-- Add tags section preferences to users table
ALTER TABLE users ADD COLUMN tags_collapsed INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN tags_section_height INTEGER NOT NULL DEFAULT 120;
