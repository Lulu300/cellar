-- The constraints below refuse data that earlier versions let in, through their API, the CSV and
-- JSON imports, or a database edited by hand. That data is repaired first, so that every database
-- can be upgraded, without losing what the user entered: a value that has to go is written into
-- the notes of its bottle, or the description of its wine.

-- Blanks are the common ones: spaces, tabs and line breaks, char(32, 9, 10, 13).

-- A status in another case or with blanks around it, or blank (the default then), becomes the
-- status it stands for. Any other status is one the app never offered: the app treated it like a
-- bottle out of the cellar (not in stock, not consumed), so it becomes one.
UPDATE `wine_bottles` SET `availability` = lower(trim(`availability`, char(32, 9, 10, 13)))
WHERE `availability` <> lower(trim(`availability`, char(32, 9, 10, 13)))
	AND lower(trim(`availability`, char(32, 9, 10, 13))) IN ('available', 'out_of_cellar', 'consumed');
--> statement-breakpoint
UPDATE `wine_bottles` SET `availability` = 'available' WHERE trim(`availability`, char(32, 9, 10, 13)) = '';
--> statement-breakpoint
UPDATE `wine_bottles`
SET `notes` = CASE WHEN coalesce(`notes`, '') = '' THEN '' ELSE `notes` || char(10) END
		|| 'Status "' || `availability` || '" replaced by "out_of_cellar" in the Cellar upgrade.',
	`availability` = 'out_of_cellar'
WHERE `availability` NOT IN ('available', 'out_of_cellar', 'consumed');
--> statement-breakpoint
-- A barcode is kept without the blanks around it, which a scan never reads, and a blank one stands
-- for none.
UPDATE `wine_bottles` SET `barcode` = nullif(trim(`barcode`, char(32, 9, 10, 13)), '')
WHERE `barcode` IS NOT nullif(trim(`barcode`, char(32, 9, 10, 13)), '');
--> statement-breakpoint
-- A barcode on several bottles stays on one: an available bottle, the oldest of them first, as a
-- scan found the oldest bottle. The others lose it.
UPDATE `wine_bottles`
SET `notes` = CASE WHEN coalesce(`notes`, '') = '' THEN '' ELSE `notes` || char(10) END
		|| 'Barcode ' || `barcode` || ' removed in the Cellar upgrade: another bottle has it.',
	`barcode` = NULL
WHERE `id` IN (
	SELECT `id` FROM (
		SELECT `id`, row_number() OVER (
			PARTITION BY `barcode` ORDER BY `availability` = 'available' DESC, `created_at`, `rowid`
		) AS `rank`
		FROM `wine_bottles`
		WHERE `barcode` IS NOT NULL
	)
	WHERE `rank` > 1
);
--> statement-breakpoint
-- Ratings go from 1 to 5, halves included. The app shows 0 as no rating.
UPDATE `wine_definitions` SET `rating` = NULL WHERE `rating` = 0;
--> statement-breakpoint
UPDATE `wine_definitions`
SET `description` = CASE WHEN coalesce(`description`, '') = '' THEN '' ELSE `description` || char(10) END
		|| 'Rating ' || `rating` || ' removed in the Cellar upgrade: ratings go from 1 to 5.',
	`rating` = NULL
WHERE `rating` IS NOT NULL AND NOT (typeof(`rating`) IN ('integer', 'real') AND `rating` BETWEEN 1 AND 5);
--> statement-breakpoint
-- Regions of the same name in a country become one, the oldest, which takes the appellations of
-- the others; then the same for the appellations of a region, which may now have the same name
-- twice, and their wines.
CREATE TEMP TABLE `region_merges` AS
SELECT `id` AS `duplicate_id`, (
	SELECT `kept`.`id` FROM `regions` AS `kept`
	WHERE `kept`.`country_id` = `regions`.`country_id` AND `kept`.`name` = `regions`.`name`
	ORDER BY `kept`.`created_at`, `kept`.`rowid` LIMIT 1
) AS `kept_id`
FROM `regions`;
--> statement-breakpoint
UPDATE `appellations`
SET `region_id` = (SELECT `kept_id` FROM `region_merges` WHERE `duplicate_id` = `region_id`)
WHERE `region_id` IN (SELECT `duplicate_id` FROM `region_merges` WHERE `duplicate_id` <> `kept_id`);
--> statement-breakpoint
DELETE FROM `regions` WHERE `id` IN (SELECT `duplicate_id` FROM `region_merges` WHERE `duplicate_id` <> `kept_id`);
--> statement-breakpoint
DROP TABLE `region_merges`;
--> statement-breakpoint
CREATE TEMP TABLE `appellation_merges` AS
SELECT `id` AS `duplicate_id`, (
	SELECT `kept`.`id` FROM `appellations` AS `kept`
	WHERE `kept`.`region_id` = `appellations`.`region_id` AND `kept`.`name` = `appellations`.`name`
	ORDER BY `kept`.`created_at`, `kept`.`rowid` LIMIT 1
) AS `kept_id`
FROM `appellations`;
--> statement-breakpoint
UPDATE `wine_definitions`
SET `appellation_id` = (SELECT `kept_id` FROM `appellation_merges` WHERE `duplicate_id` = `appellation_id`)
WHERE `appellation_id` IN (SELECT `duplicate_id` FROM `appellation_merges` WHERE `duplicate_id` <> `kept_id`);
--> statement-breakpoint
DELETE FROM `appellations` WHERE `id` IN (SELECT `duplicate_id` FROM `appellation_merges` WHERE `duplicate_id` <> `kept_id`);
--> statement-breakpoint
DROP TABLE `appellation_merges`;
--> statement-breakpoint
-- No version showed or used the parent of a container: only the imports set it, to any text. One
-- that names no container is dropped, as the new foreign key would refuse it.
UPDATE `storage_containers` SET `parent_container_id` = NULL
WHERE `parent_container_id` NOT IN (SELECT `id` FROM `storage_containers`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_wine_bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_id` text NOT NULL,
	`vintage` integer,
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
	FOREIGN KEY (`storage_case_id`) REFERENCES `storage_cases`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "wine_bottles_availability_check" CHECK(availability IN ('available', 'out_of_cellar', 'consumed'))
);
--> statement-breakpoint
INSERT INTO `__new_wine_bottles`("id", "definition_id", "vintage", "optimum", "origin_id", "format_id", "barcode", "purchase_price", "purchase_date", "current_value", "current_value_date", "storage_case_id", "notes", "availability", "consumed_date", "created_at", "updated_at") SELECT "id", "definition_id", "vintage", "optimum", "origin_id", "format_id", "barcode", "purchase_price", "purchase_date", "current_value", "current_value_date", "storage_case_id", "notes", "availability", "consumed_date", "created_at", "updated_at" FROM `wine_bottles`;--> statement-breakpoint
DROP TABLE `wine_bottles`;--> statement-breakpoint
ALTER TABLE `__new_wine_bottles` RENAME TO `wine_bottles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `wine_bottles_barcode_unique` ON `wine_bottles` (`barcode`) WHERE "wine_bottles"."barcode" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `wine_bottles_definition_id_idx` ON `wine_bottles` (`definition_id`);--> statement-breakpoint
CREATE INDEX `wine_bottles_origin_id_idx` ON `wine_bottles` (`origin_id`);--> statement-breakpoint
CREATE INDEX `wine_bottles_format_id_idx` ON `wine_bottles` (`format_id`);--> statement-breakpoint
CREATE INDEX `wine_bottles_storage_case_id_idx` ON `wine_bottles` (`storage_case_id`);--> statement-breakpoint
CREATE TABLE `__new_wine_definitions` (
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
	FOREIGN KEY (`image_id`) REFERENCES `wine_images`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "wine_definitions_rating_check" CHECK(rating BETWEEN 1 AND 5)
);
--> statement-breakpoint
INSERT INTO `__new_wine_definitions`("id", "name", "producer", "appellation_id", "classification_id", "type_id", "color_id", "rating", "website", "description", "image_id", "grape_varieties", "target_quantity", "created_at", "updated_at") SELECT "id", "name", "producer", "appellation_id", "classification_id", "type_id", "color_id", "rating", "website", "description", "image_id", "grape_varieties", "target_quantity", "created_at", "updated_at" FROM `wine_definitions`;--> statement-breakpoint
DROP TABLE `wine_definitions`;--> statement-breakpoint
ALTER TABLE `__new_wine_definitions` RENAME TO `wine_definitions`;--> statement-breakpoint
CREATE INDEX `wine_definitions_appellation_id_idx` ON `wine_definitions` (`appellation_id`);--> statement-breakpoint
CREATE INDEX `wine_definitions_classification_id_idx` ON `wine_definitions` (`classification_id`);--> statement-breakpoint
CREATE INDEX `wine_definitions_type_id_idx` ON `wine_definitions` (`type_id`);--> statement-breakpoint
CREATE INDEX `wine_definitions_color_id_idx` ON `wine_definitions` (`color_id`);--> statement-breakpoint
CREATE INDEX `wine_definitions_image_id_idx` ON `wine_definitions` (`image_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appellations_region_id_name_unique` ON `appellations` (`region_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `regions_country_id_name_unique` ON `regions` (`country_id`,`name`);--> statement-breakpoint
CREATE INDEX `storage_cases_container_id_idx` ON `storage_cases` (`container_id`);--> statement-breakpoint
CREATE TABLE `__new_storage_containers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_container_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_container_id`) REFERENCES `storage_containers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_storage_containers`("id", "name", "parent_container_id", "created_at", "updated_at") SELECT "id", "name", "parent_container_id", "created_at", "updated_at" FROM `storage_containers`;--> statement-breakpoint
DROP TABLE `storage_containers`;--> statement-breakpoint
ALTER TABLE `__new_storage_containers` RENAME TO `storage_containers`;--> statement-breakpoint
CREATE INDEX `storage_containers_parent_container_id_idx` ON `storage_containers` (`parent_container_id`);