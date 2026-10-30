-- 0 means no vintage. Up to 0.6.0 the CSV import stored a blank vintage as 0, which half the app
-- read as no vintage and the other half as the year 0. Only the vintage: no version wrote 0 for a
-- blank optimum.
UPDATE `wine_bottles` SET `vintage` = NULL WHERE `vintage` = 0;
