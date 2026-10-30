-- From 0.10.0 a note or a description holds at most 5,000 characters: LONG_TEXT_MAX_LENGTH in
-- src/lib/shared/schemas/common.ts, written out here because a migration must not change when the
-- constant does. Earlier versions took up to 100,000: the end of a longer text is cut, which the
-- release notes say. The forms of earlier versions stored each line break as CRLF, which the app
-- now counts, and stores, as one LF: every text gets LF line breaks, so that it is measured and
-- cut as the app counts it. SQLite counts code points where the app counts UTF-16 units, as
-- browsers do: a text cut here counts one more in the app for each emoji it holds, and has to be
-- shortened before it is saved again.
UPDATE `wine_bottles`
SET `notes` = substr(replace(`notes`, char(13, 10), char(10)), 1, 5000)
WHERE instr(`notes`, char(13, 10)) > 0 OR length(`notes`) > 5000;
--> statement-breakpoint
UPDATE `wine_definitions`
SET `description` = substr(replace(`description`, char(13, 10), char(10)), 1, 5000)
WHERE instr(`description`, char(13, 10)) > 0 OR length(`description`) > 5000;
