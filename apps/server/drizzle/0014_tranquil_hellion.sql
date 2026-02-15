ALTER TABLE `users` ADD `theme` text DEFAULT 'dark' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `dark_theme_base` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `light_theme_base` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accent_color` text DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `editor_font_size` text DEFAULT 'M' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `editor_font_family` text DEFAULT 'inter' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `sidebar_collapsed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `sidebar_width` integer DEFAULT 288 NOT NULL;