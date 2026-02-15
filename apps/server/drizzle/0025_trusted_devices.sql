-- Trusted devices for 2FA "remember this device" feature
CREATE TABLE `trusted_devices` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL UNIQUE,
  `user_agent` text,
  `ip_address` text,
  `label` text,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trusted_devices_user_idx` ON `trusted_devices` (`user_id`);
--> statement-breakpoint
CREATE INDEX `trusted_devices_token_hash_idx` ON `trusted_devices` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `trusted_devices_expires_idx` ON `trusted_devices` (`expires_at`);
