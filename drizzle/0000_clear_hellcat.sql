CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);--> statement-breakpoint
CREATE TABLE `appellations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `countries_name_unique` ON `countries` (`name`);--> statement-breakpoint
CREATE TABLE `label_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`page_format` text NOT NULL,
	`label_width` real NOT NULL,
	`label_height` real NOT NULL,
	`margin_top` real NOT NULL,
	`margin_left` real NOT NULL,
	`margin_bottom` real NOT NULL,
	`margin_right` real NOT NULL,
	`padding` real NOT NULL,
	`code_type` text NOT NULL,
	`show_code_value` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `label_presets_name_unique` ON `label_presets` (`name`);--> statement-breakpoint
CREATE TABLE `origins` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `origins_name_unique` ON `origins` (`name`);--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `storage_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`container_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `storage_containers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `storage_containers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_container_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wine_bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_id` text NOT NULL,
	`vintage` integer NOT NULL,
	`optimum` integer,
	`origin_id` text,
	`format_id` text NOT NULL,
	`barcode` text,
	`purchase_price` real,
	`purchase_date` integer,
	`current_value` real,
	`current_value_date` integer,
	`storage_case_id` text,
	`notes` text,
	`availability` text DEFAULT 'available' NOT NULL,
	`consumed_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`definition_id`) REFERENCES `wine_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`origin_id`) REFERENCES `origins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`format_id`) REFERENCES `wine_formats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storage_case_id`) REFERENCES `storage_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wine_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wine_classifications_name_unique` ON `wine_classifications` (`name`);--> statement-breakpoint
CREATE TABLE `wine_colors` (
	`id` text PRIMARY KEY NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wine_colors_color_unique` ON `wine_colors` (`color`);--> statement-breakpoint
CREATE TABLE `wine_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`producer` text,
	`appellation_id` text NOT NULL,
	`classification_id` text,
	`type_id` text NOT NULL,
	`color_id` text NOT NULL,
	`rating` integer,
	`website` text,
	`description` text,
	`image_id` text,
	`grape_varieties` text DEFAULT '[]',
	`target_quantity` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`appellation_id`) REFERENCES `appellations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classification_id`) REFERENCES `wine_classifications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`type_id`) REFERENCES `wine_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`color_id`) REFERENCES `wine_colors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_id`) REFERENCES `wine_images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wine_formats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wine_formats_name_unique` ON `wine_formats` (`name`);--> statement-breakpoint
CREATE TABLE `wine_images` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`path` text DEFAULT '/uploads/wines/' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wine_images_filename_unique` ON `wine_images` (`filename`);--> statement-breakpoint
CREATE TABLE `wine_types` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wine_types_type_unique` ON `wine_types` (`type`);