ALTER TABLE `storage_cases` ADD `position` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Each case takes the place that the storage page gave it up to this release, in its container:
-- by the number that ends its name (none counts as 0), then by name. Run again, the update gives
-- the same positions.
UPDATE `storage_cases` SET `position` = `ordered`.`position`
FROM (
	SELECT `id`, row_number() OVER (
		PARTITION BY `container_id`
		ORDER BY CAST(substr(`name`, length(rtrim(`name`, '0123456789')) + 1) AS INTEGER), `name`, `id`
	) - 1 AS `position`
	FROM `storage_cases`
) AS `ordered`
WHERE `ordered`.`id` = `storage_cases`.`id`;
