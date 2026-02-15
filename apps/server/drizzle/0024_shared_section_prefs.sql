-- Add shared section preferences to users table
ALTER TABLE users ADD COLUMN shared_collapsed INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN shared_section_height INTEGER NOT NULL DEFAULT 150;
