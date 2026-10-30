-- 0001 added these three columns empty. Until this release, every start filled the empty ones with
-- the same UPDATE, run from TypeScript: the old padding inside the label, and a 2 mm gap between
-- labels. Values already set are kept, so databases where that ran come out unchanged.
UPDATE `label_presets`
SET `label_padding` = COALESCE(`label_padding`, `padding`),
	`horizontal_spacing` = COALESCE(`horizontal_spacing`, 2),
	`vertical_spacing` = COALESCE(`vertical_spacing`, 2)
WHERE `label_padding` IS NULL OR `horizontal_spacing` IS NULL OR `vertical_spacing` IS NULL;
