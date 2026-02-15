-- Create email_otp_codes table for email-based 2FA
CREATE TABLE `email_otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `email_otp_codes_user_idx` ON `email_otp_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_otp_codes_expires_idx` ON `email_otp_codes` (`expires_at`);--> statement-breakpoint

-- Drop old pending_2fa_setup table (no longer needed for email-based 2FA)
DROP TABLE IF EXISTS `pending_2fa_setup`;
