CREATE TABLE `revoked_access_tokens` (
	`jti` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `revoked_access_tokens_expires_idx` ON `revoked_access_tokens` (`expires_at`);
