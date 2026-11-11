CREATE TABLE `producers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country_id` text,
	`region_id` text,
	`website` text,
	`contact` text,
	`description` text,
	`image_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`image_id`) REFERENCES `wine_images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `producers_name_unique` ON `producers` (`name`);--> statement-breakpoint
CREATE INDEX `producers_country_id_idx` ON `producers` (`country_id`);--> statement-breakpoint
CREATE INDEX `producers_region_id_idx` ON `producers` (`region_id`);--> statement-breakpoint
CREATE INDEX `producers_image_id_idx` ON `producers` (`image_id`);--> statement-breakpoint
ALTER TABLE `wine_definitions` ADD `producer_id` text REFERENCES producers(id);--> statement-breakpoint
CREATE INDEX `wine_definitions_producer_id_idx` ON `wine_definitions` (`producer_id`);