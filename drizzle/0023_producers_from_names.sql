-- From 1.8.0 a wine's producer is a row of `producers` (FEAT-07). Each producer name typed on a
-- wine becomes a producer, and the names that differ only in case, accents or blanks become one:
-- they share the key of cellar_producer_key, which migrateSchema registers (producerKey in
-- src/lib/shared/names.ts). Each producer keeps the spelling of the most wines, then of the
-- wine changed last, with its blanks tidied (cellar_tidy_name: one space between words); a name
-- longer than the forms take stays whole. A wine without a producer, or with a blank one, gets none.
-- Migration 0024 then drops the column of the names.
INSERT INTO `producers` (`id`, `name`, `created_at`, `updated_at`)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2)
        || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2)
        || '-' || hex(randomblob(6))),
    `spelling`,
    `created_at`,
    `created_at`
FROM (
    SELECT
        `spelling`,
        min(`first_created`) OVER (PARTITION BY `key`) AS `created_at`,
        row_number() OVER (
            PARTITION BY `key` ORDER BY `wines` DESC, `last_changed` DESC, `spelling`
        ) AS `rank`
    FROM (
        SELECT
            cellar_producer_key(`producer`) AS `key`,
            cellar_tidy_name(`producer`) AS `spelling`,
            count(*) AS `wines`,
            max(`updated_at`) AS `last_changed`,
            min(`created_at`) AS `first_created`
        FROM `wine_definitions`
        WHERE cellar_producer_key(`producer`) <> ''
        GROUP BY `key`, `spelling`
    )
)
WHERE `rank` = 1;
--> statement-breakpoint
UPDATE `wine_definitions`
SET `producer_id` = (
    SELECT `id` FROM `producers`
    WHERE cellar_producer_key(`producers`.`name`) = cellar_producer_key(`wine_definitions`.`producer`)
)
WHERE cellar_producer_key(`producer`) <> '';
