-- Add onboarding_completed flag to users table (server-side persistence)
ALTER TABLE `users` ADD COLUMN `onboarding_completed` integer NOT NULL DEFAULT 0;
