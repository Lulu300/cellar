CREATE TABLE `wishes` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_id` text,
	`text` text,
	`image_id` text,
	`quantity` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`definition_id`) REFERENCES `wine_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `wine_images`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "wishes_wine_or_text_check" CHECK((definition_id IS NULL) <> (text IS NULL) AND (definition_id IS NULL OR image_id IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishes_definition_id_unique` ON `wishes` (`definition_id`);--> statement-breakpoint
CREATE INDEX `wishes_image_id_idx` ON `wishes` (`image_id`);