-- The presets that label_presets.csv shipped from 0.1.0 to 0.8.0 had wrong Avery sheets (a 2 mm gap
-- between rows: labels lost and printed off the die cuts) and five labels too narrow for a barcode,
-- which the PDF refuses. Each one gets the values of the corrected file, but only while it keeps
-- its name and the measures it was shipped with, and its barcode for the five: a preset that the
-- user changed is kept as it is. Its description, border and code value do not matter, and stay.
UPDATE `label_presets`
SET `margin_top` = 12.7,
	`margin_left` = 4.7625,
	`margin_right` = 4.7625,
	`horizontal_spacing` = 3.175,
	`vertical_spacing` = 0
WHERE `name` = 'Avery 5160'
	AND `page_format` = 'Letter'
	AND `label_width` = 66.675
	AND `label_height` = 25.4
	AND `margin_top` = 11.8
	AND `margin_left` = 4.6
	AND `margin_bottom` = 12.7
	AND `margin_right` = 4.6
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2;
--> statement-breakpoint
UPDATE `label_presets`
SET `margin_top` = 12.7,
	`margin_left` = 4.233,
	`margin_right` = 3.687,
	`horizontal_spacing` = 4.78,
	`vertical_spacing` = 0
WHERE `name` = 'Avery 5161'
	AND `page_format` = 'Letter'
	AND `label_width` = 101.6
	AND `label_height` = 25.4
	AND `margin_top` = 11.8
	AND `margin_left` = 4.6
	AND `margin_bottom` = 12.7
	AND `margin_right` = 4.6
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2;
--> statement-breakpoint
UPDATE `label_presets`
SET `label_height` = 33.867,
	`margin_top` = 21.149,
	`margin_left` = 3.951,
	`margin_bottom` = 21.184,
	`margin_right` = 3.986,
	`horizontal_spacing` = 4.763,
	`vertical_spacing` = 0
WHERE `name` = 'Avery 5162'
	AND `page_format` = 'Letter'
	AND `label_width` = 101.6
	AND `label_height` = 33.9
	AND `margin_top` = 11.8
	AND `margin_left` = 4.6
	AND `margin_bottom` = 12.7
	AND `margin_right` = 4.6
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2;
--> statement-breakpoint
UPDATE `label_presets`
SET `margin_top` = 12.7,
	`margin_left` = 3.951,
	`margin_right` = 3.969,
	`horizontal_spacing` = 4.78,
	`vertical_spacing` = 0
WHERE `name` = 'Avery 5163'
	AND `page_format` = 'Letter'
	AND `label_width` = 101.6
	AND `label_height` = 50.8
	AND `margin_top` = 11.8
	AND `margin_left` = 4.6
	AND `margin_bottom` = 12.7
	AND `margin_right` = 4.6
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2;
--> statement-breakpoint
UPDATE `label_presets`
SET `label_height` = 84.667,
	`margin_top` = 12.7,
	`margin_left` = 3.951,
	`margin_right` = 3.969,
	`horizontal_spacing` = 4.78,
	`vertical_spacing` = 0
WHERE `name` = 'Avery 5164'
	AND `page_format` = 'Letter'
	AND `label_width` = 101.6
	AND `label_height` = 84.7
	AND `margin_top` = 11.8
	AND `margin_left` = 4.6
	AND `margin_bottom` = 12.7
	AND `margin_right` = 4.6
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2;
--> statement-breakpoint
UPDATE `label_presets`
SET `margin_top` = 12.7,
	`margin_left` = 4.7625,
	`margin_right` = 4.7625,
	`horizontal_spacing` = 3.175,
	`vertical_spacing` = 0
WHERE `name` = 'Avery 8160'
	AND `page_format` = 'Letter'
	AND `label_width` = 66.675
	AND `label_height` = 25.4
	AND `margin_top` = 11.8
	AND `margin_left` = 4.6
	AND `margin_bottom` = 12.7
	AND `margin_right` = 4.6
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2;
--> statement-breakpoint
UPDATE `label_presets`
SET `code_type` = 'qrcode'
WHERE `name` = 'Brother DK-22210'
	AND `page_format` = 'A4'
	AND `label_width` = 29
	AND `label_height` = 25.4
	AND `margin_top` = 0
	AND `margin_left` = 0
	AND `margin_bottom` = 0
	AND `margin_right` = 0
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 0
	AND `vertical_spacing` = 0
	AND `code_type` = 'barcode';
--> statement-breakpoint
UPDATE `label_presets`
SET `code_type` = 'qrcode'
WHERE `name` = 'Dymo 30320'
	AND `page_format` = 'A4'
	AND `label_width` = 51
	AND `label_height` = 19
	AND `margin_top` = 0
	AND `margin_left` = 0
	AND `margin_bottom` = 0
	AND `margin_right` = 0
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 0
	AND `vertical_spacing` = 0
	AND `code_type` = 'barcode';
--> statement-breakpoint
UPDATE `label_presets`
SET `code_type` = 'qrcode'
WHERE `name` = 'Zebra 2x1'
	AND `page_format` = 'A4'
	AND `label_width` = 50
	AND `label_height` = 25
	AND `margin_top` = 0
	AND `margin_left` = 0
	AND `margin_bottom` = 0
	AND `margin_right` = 0
	AND `padding` = 1
	AND `label_padding` = 1
	AND `horizontal_spacing` = 0
	AND `vertical_spacing` = 0
	AND `code_type` = 'barcode';
--> statement-breakpoint
UPDATE `label_presets`
SET `code_type` = 'qrcode'
WHERE `name` = 'Generic 40x25'
	AND `page_format` = 'A4'
	AND `label_width` = 40
	AND `label_height` = 25
	AND `margin_top` = 10
	AND `margin_left` = 10
	AND `margin_bottom` = 10
	AND `margin_right` = 10
	AND `padding` = 1.5
	AND `label_padding` = 1.5
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2
	AND `code_type` = 'barcode';
--> statement-breakpoint
UPDATE `label_presets`
SET `code_type` = 'qrcode'
WHERE `name` = 'Generic 50x30'
	AND `page_format` = 'A4'
	AND `label_width` = 50
	AND `label_height` = 30
	AND `margin_top` = 10
	AND `margin_left` = 10
	AND `margin_bottom` = 10
	AND `margin_right` = 10
	AND `padding` = 1.5
	AND `label_padding` = 1.5
	AND `horizontal_spacing` = 2
	AND `vertical_spacing` = 2
	AND `code_type` = 'barcode';
