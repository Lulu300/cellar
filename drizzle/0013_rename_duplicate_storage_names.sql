-- From 0.11.0 a container name is unique, and a case name is unique within its container: the next
-- migration adds the unique indexes. The duplicates that earlier versions accepted are renamed here,
-- never merged, so no bottle moves: the oldest row keeps its name, the others get the first free
-- "name (2)", "name (3)"… A case named after a container that is renamed follows it, as the next
-- save of the container would rename it: case "A1" of the second container "A" becomes "A (2)1".
-- Names are compared exactly, as the unique indexes compare them.
CREATE TEMP TABLE `renamed_containers` AS
WITH RECURSIVE
	`ranked` AS (
		SELECT `id`, `name`,
			row_number() OVER (PARTITION BY `name` ORDER BY `created_at`, `rowid`) AS `copy`,
			count(*) OVER (PARTITION BY `name`) AS `copies`
		FROM `storage_containers`
	),
	-- Enough numbers for every copy to find a free name, even if each container takes one.
	`numbers` (`name`, `n`, `last`) AS (
		SELECT `name`, 2, `copies` + (SELECT count(*) FROM `storage_containers`)
		FROM `ranked` WHERE `copy` = 2
		UNION ALL
		SELECT `name`, `n` + 1, `last` FROM `numbers` WHERE `n` < `last`
	),
	`free` AS (
		SELECT `name`, `name` || ' (' || `n` || ')' AS `new_name`,
			row_number() OVER (PARTITION BY `name` ORDER BY `n`) + 1 AS `copy`
		FROM `numbers`
		WHERE `name` || ' (' || `n` || ')' NOT IN (SELECT `name` FROM `storage_containers`)
	)
SELECT `ranked`.`id`, `ranked`.`name` AS `old_name`, `free`.`new_name`
FROM `ranked` JOIN `free` ON `free`.`name` = `ranked`.`name` AND `free`.`copy` = `ranked`.`copy`;
--> statement-breakpoint
UPDATE `storage_cases`
SET `name` = `renamed`.`new_name` || substr(`storage_cases`.`name`, length(`renamed`.`old_name`) + 1),
	`updated_at` = unixepoch()
FROM `renamed_containers` AS `renamed`
WHERE `storage_cases`.`container_id` = `renamed`.`id`
	AND substr(`storage_cases`.`name`, 1, length(`renamed`.`old_name`)) = `renamed`.`old_name`;
--> statement-breakpoint
UPDATE `storage_containers`
SET `name` = `renamed`.`new_name`, `updated_at` = unixepoch()
FROM `renamed_containers` AS `renamed`
WHERE `storage_containers`.`id` = `renamed`.`id`;
--> statement-breakpoint
DROP TABLE `renamed_containers`;
--> statement-breakpoint
WITH RECURSIVE
	`ranked` AS (
		SELECT `id`, `container_id`, `name`,
			row_number() OVER (
				PARTITION BY `container_id`, `name` ORDER BY `created_at`, `rowid`
			) AS `copy`,
			count(*) OVER (PARTITION BY `container_id`, `name`) AS `copies`
		FROM `storage_cases`
	),
	-- Enough numbers for every copy to find a free name, even if each case of the container
	-- takes one.
	`numbers` (`container_id`, `name`, `n`, `last`) AS (
		SELECT `container_id`, `name`, 2, `copies` + (
			SELECT count(*) FROM `storage_cases` AS `other`
			WHERE `other`.`container_id` = `ranked`.`container_id`
		)
		FROM `ranked` WHERE `copy` = 2
		UNION ALL
		SELECT `container_id`, `name`, `n` + 1, `last` FROM `numbers` WHERE `n` < `last`
	),
	`free` AS (
		SELECT `container_id`, `name`, `name` || ' (' || `n` || ')' AS `new_name`,
			row_number() OVER (PARTITION BY `container_id`, `name` ORDER BY `n`) + 1 AS `copy`
		FROM `numbers`
		WHERE NOT EXISTS (
			SELECT 1 FROM `storage_cases` AS `other`
			WHERE `other`.`container_id` = `numbers`.`container_id`
				AND `other`.`name` = `numbers`.`name` || ' (' || `numbers`.`n` || ')'
		)
	)
UPDATE `storage_cases`
SET `name` = `free`.`new_name`, `updated_at` = unixepoch()
FROM `ranked`
	JOIN `free` ON `free`.`container_id` = `ranked`.`container_id`
		AND `free`.`name` = `ranked`.`name`
		AND `free`.`copy` = `ranked`.`copy`
WHERE `storage_cases`.`id` = `ranked`.`id`;
