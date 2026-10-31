CREATE TABLE `wine_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_id` text NOT NULL,
	`image_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`definition_id`) REFERENCES `wine_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `wine_images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wine_photos_definition_id_image_id_unique` ON `wine_photos` (`definition_id`,`image_id`);--> statement-breakpoint
CREATE INDEX `wine_photos_image_id_idx` ON `wine_photos` (`image_id`);