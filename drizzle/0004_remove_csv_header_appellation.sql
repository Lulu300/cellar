-- Until this release, the seeding read the header line of appellations.csv as data: every install has a
-- country "Pays", its region "Région" and their appellation "Appellation". They are removed together,
-- and only while nothing else hangs on them: no wine on the appellation, no other appellation in the
-- region, no other region in the country. Otherwise someone uses them, and they stay as they are.
-- The three ids are kept in a temporary table because deleting the appellation would change the
-- answer for the region, and deleting the region the answer for the country.
CREATE TEMP TABLE `csv_header_entries` AS
SELECT `countries`.`id` AS `country_id`, `regions`.`id` AS `region_id`, `appellations`.`id` AS `appellation_id`
FROM `countries`
JOIN `regions` ON `regions`.`country_id` = `countries`.`id`
JOIN `appellations` ON `appellations`.`region_id` = `regions`.`id`
WHERE `countries`.`name` = 'Pays'
	AND `regions`.`name` = 'Région'
	AND `appellations`.`name` = 'Appellation'
	AND (SELECT count(*) FROM `regions` WHERE `country_id` = `countries`.`id`) = 1
	AND (SELECT count(*) FROM `appellations` WHERE `region_id` = `regions`.`id`) = 1
	AND NOT EXISTS (SELECT 1 FROM `wine_definitions` WHERE `appellation_id` = `appellations`.`id`);
--> statement-breakpoint
DELETE FROM `appellations` WHERE `id` IN (SELECT `appellation_id` FROM `csv_header_entries`);
--> statement-breakpoint
DELETE FROM `regions` WHERE `id` IN (SELECT `region_id` FROM `csv_header_entries`);
--> statement-breakpoint
DELETE FROM `countries` WHERE `id` IN (SELECT `country_id` FROM `csv_header_entries`);
--> statement-breakpoint
DROP TABLE `csv_header_entries`;
