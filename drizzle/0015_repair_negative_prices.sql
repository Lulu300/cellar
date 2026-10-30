-- From 0.11.0 a purchase price or a current value is 0 or more. Earlier versions took a negative
-- one through their API and imports: it is removed here, and written into the notes of its bottle,
-- as migration 0006 repaired the other refused values. The added line may make the notes longer
-- than the 5,000 characters of the app (migration 0011): they are cut to that length, as an import
-- cuts the notes of an older file after the same repair, so the line is lost, in part or whole,
-- from notes already that long. The database has no CHECK on that length: an uncut note would not
-- stop the upgrade, but would break the rule that every note keeps since 0.10.0. A whole amount is
-- written without the ".0" that SQLite gives a REAL, as the import writes it.
UPDATE `wine_bottles`
SET `notes` = substr(
		CASE WHEN coalesce(`notes`, '') = '' THEN '' ELSE `notes` || char(10) END
			|| 'Purchase price '
			|| CASE WHEN `purchase_price` = CAST(`purchase_price` AS INTEGER)
				THEN CAST(`purchase_price` AS INTEGER) ELSE `purchase_price` END
			|| ' removed in the Cellar upgrade: prices are 0 or more.',
		1, 5000),
	`purchase_price` = NULL
WHERE `purchase_price` < 0;
--> statement-breakpoint
UPDATE `wine_bottles`
SET `notes` = substr(
		CASE WHEN coalesce(`notes`, '') = '' THEN '' ELSE `notes` || char(10) END
			|| 'Current value '
			|| CASE WHEN `current_value` = CAST(`current_value` AS INTEGER)
				THEN CAST(`current_value` AS INTEGER) ELSE `current_value` END
			|| ' removed in the Cellar upgrade: values are 0 or more.',
		1, 5000),
	`current_value` = NULL
WHERE `current_value` < 0;
