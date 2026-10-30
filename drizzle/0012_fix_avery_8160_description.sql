-- Avery 8160 is an inkjet sheet, which label_presets.csv described as a laser one up to 0.10.0. Only
-- the description that Cellar shipped is corrected: one that the user wrote is kept.
UPDATE `label_presets`
SET `description` = 'Avery 8160 Address Labels (2.625" x 1") - Inkjet'
WHERE `name` = 'Avery 8160'
	AND `description` = 'Avery 8160 Address Labels (2.625" x 1") - Laser';
