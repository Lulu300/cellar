PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_wine_bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_id` text NOT NULL,
	`vintage` integer,
	`optimum` integer,
	`origin_id` text,
	`format_id` text NOT NULL,
	`barcode` text,
	`purchase_price` real,
	`purchase_date` integer,
	`current_value` real,
	`current_value_date` integer,
	`storage_case_id` text,
	`notes` text,
	`availability` text DEFAULT 'available' NOT NULL,
	`consumed_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`definition_id`) REFERENCES `wine_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`origin_id`) REFERENCES `origins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`format_id`) REFERENCES `wine_formats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storage_case_id`) REFERENCES `storage_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_wine_bottles`("id", "definition_id", "vintage", "optimum", "origin_id", "format_id", "barcode", "purchase_price", "purchase_date", "current_value", "current_value_date", "storage_case_id", "notes", "availability", "consumed_date", "created_at", "updated_at") SELECT "id", "definition_id", "vintage", "optimum", "origin_id", "format_id", "barcode", "purchase_price", "purchase_date", "current_value", "current_value_date", "storage_case_id", "notes", "availability", "consumed_date", "created_at", "updated_at" FROM `wine_bottles`;--> statement-breakpoint
DROP TABLE `wine_bottles`;--> statement-breakpoint
ALTER TABLE `__new_wine_bottles` RENAME TO `wine_bottles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;