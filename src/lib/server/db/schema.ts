import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
    check,
    index,
    integer,
    real,
    sqliteTable,
    text,
    uniqueIndex,
    type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import type { CodeType, PageFormat } from '#lib/shared/labels.js';
import { NEUTRAL_HEX } from '#lib/shared/wine-colors.js';

const AVAILABILITIES = Object.values(BottleAvailability)
    .map((value) => `'${value}'`)
    .join(', ');

// The defaults below are applied by Drizzle when an insert leaves the column out, not by SQLite:
// they need no migration, and the SQL of a migration that inserts rows still gives every column.

/** The primary key of most tables: a random UUID by default. */
const id = () =>
    text('id')
        .primaryKey()
        .$defaultFn(() => randomUUID());

/** created_at or updated_at: the time of the insert by default. */
const timestamp = (name: 'created_at' | 'updated_at') =>
    integer(name, { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date());

// Countries table
export const countries = sqliteTable('countries', {
    id: id(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Regions table (belongs to a country)
export const regions = sqliteTable(
    'regions',
    {
        id: id(),
        name: text('name').notNull(),
        countryId: text('country_id')
            .references(() => countries.id)
            .notNull(),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [uniqueIndex('regions_country_id_name_unique').on(table.countryId, table.name)]
);

// Appellations table (belongs to a region)
export const appellations = sqliteTable(
    'appellations',
    {
        id: id(),
        name: text('name').notNull(),
        regionId: text('region_id')
            .references(() => regions.id)
            .notNull(),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [uniqueIndex('appellations_region_id_name_unique').on(table.regionId, table.name)]
);

// Wine images table
export const wineImages = sqliteTable('wine_images', {
    id: id(),
    filename: text('filename').notNull().unique(), // Unique filename on disk
    path: text('path').notNull().default('/uploads/wines/'), // Path to image directory
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

/**
 * The producers: the estates and houses that make the wines. Only the name is required; each name
 * is unique as producerKey compares names, which ignores case, accents and blanks.
 */
export const producers = sqliteTable(
    'producers',
    {
        id: id(),
        name: text('name').notNull().unique(),
        // A region gives its country: the service keeps both in step.
        countryId: text('country_id').references(() => countries.id, { onDelete: 'set null' }),
        regionId: text('region_id').references(() => regions.id, { onDelete: 'set null' }),
        website: text('website'),
        /** Its address, phone or e-mail, as free text. */
        contact: text('contact'),
        description: text('description'),
        imageId: text('image_id').references(() => wineImages.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [
        index('producers_country_id_idx').on(table.countryId),
        index('producers_region_id_idx').on(table.regionId),
        index('producers_image_id_idx').on(table.imageId)
    ]
);

// Wine definitions table (wine templates/types)
export const wineDefinitions = sqliteTable(
    'wine_definitions',
    {
        id: id(),
        name: text('name').notNull(),
        // A producer in use cannot be deleted.
        producerId: text('producer_id').references(() => producers.id),
        appellationId: text('appellation_id')
            .references(() => appellations.id)
            .notNull(),
        classificationId: text('classification_id').references(() => wineClassifications.id),
        typeId: text('type_id')
            .references(() => wineTypes.id)
            .notNull(),
        colorId: text('color_id')
            .references(() => wineColors.id)
            .notNull(),
        rating: integer('rating'), // 1-5 rating
        website: text('website'),
        description: text('description'),
        imageId: text('image_id').references(() => wineImages.id, { onDelete: 'set null' }),
        grapeVarieties: text('grape_varieties', { mode: 'json' }).$type<string[]>().default([]),
        targetQuantity: integer('target_quantity'), // Desired number of bottles to always have
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [
        index('wine_definitions_producer_id_idx').on(table.producerId),
        index('wine_definitions_appellation_id_idx').on(table.appellationId),
        index('wine_definitions_classification_id_idx').on(table.classificationId),
        index('wine_definitions_type_id_idx').on(table.typeId),
        index('wine_definitions_color_id_idx').on(table.colorId),
        index('wine_definitions_image_id_idx').on(table.imageId),
        check('wine_definitions_rating_check', sql.raw('rating BETWEEN 1 AND 5'))
    ]
);

/**
 * The photos of a wine besides its main one, `wine_definitions.image_id`, which the wine list
 * shows: keeping the main photo there leaves every reader of a wine's image as it was.
 */
export const winePhotos = sqliteTable(
    'wine_photos',
    {
        id: id(),
        definitionId: text('definition_id')
            .references(() => wineDefinitions.id, { onDelete: 'cascade' })
            .notNull(),
        imageId: text('image_id')
            .references(() => wineImages.id, { onDelete: 'cascade' })
            .notNull(),
        createdAt: timestamp('created_at')
    },
    (table) => [
        uniqueIndex('wine_photos_definition_id_image_id_unique').on(
            table.definitionId,
            table.imageId
        ),
        index('wine_photos_image_id_idx').on(table.imageId)
    ]
);

/**
 * The wishlist: a wine of the cellar, at most once, or a text with a photo if wanted, for a wine
 * not in it yet. A text wish that becomes a wine keeps its quantity and note, and gives its photo
 * to the wine.
 */
export const wishes = sqliteTable(
    'wishes',
    {
        id: id(),
        definitionId: text('definition_id').references(() => wineDefinitions.id, {
            onDelete: 'cascade'
        }),
        text: text('text'),
        imageId: text('image_id').references(() => wineImages.id, { onDelete: 'set null' }),
        quantity: integer('quantity'),
        note: text('note'),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [
        uniqueIndex('wishes_definition_id_unique').on(table.definitionId),
        index('wishes_image_id_idx').on(table.imageId),
        check(
            'wishes_wine_or_text_check',
            sql.raw(
                '(definition_id IS NULL) <> (text IS NULL) AND (definition_id IS NULL OR image_id IS NULL)'
            )
        )
    ]
);

// Wine types table
export const wineTypes = sqliteTable('wine_types', {
    id: id(),
    type: text('type').notNull().unique(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Wine colors table
export const wineColors = sqliteTable('wine_colors', {
    id: id(),
    color: text('color').notNull().unique(),
    // `#rrggbb`. SQLite's default fills the rows of earlier versions; migration 0019 then gives
    // the seeded ones their colour (startingHex).
    hex: text('hex').notNull().default(NEUTRAL_HEX),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Wine classifications table
export const wineClassifications = sqliteTable('wine_classifications', {
    id: id(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Wine formats table
export const wineFormats = sqliteTable('wine_formats', {
    id: id(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Origins table (stores unique origin values)
export const origins = sqliteTable('origins', {
    id: id(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at')
});

// Storage containers table (shelves/columns like A, B, C, D, E)
export const storageContainers = sqliteTable(
    'storage_containers',
    {
        id: id(),
        name: text('name').notNull(),
        parentContainerId: text('parent_container_id').references(
            (): AnySQLiteColumn => storageContainers.id,
            { onDelete: 'set null' }
        ),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [
        index('storage_containers_parent_container_id_idx').on(table.parentContainerId),
        // The CSV files tell a container by its name; 0013 renamed the duplicates.
        uniqueIndex('storage_containers_name_unique').on(table.name)
    ]
);

// Storage cases table (individual cases like A1, A2, B1, B2, etc.)
export const storageCases = sqliteTable(
    'storage_cases',
    {
        id: id(),
        name: text('name').notNull(),
        capacity: integer('capacity').notNull(),
        containerId: text('container_id')
            .references(() => storageContainers.id)
            .notNull(),
        /** The place of the case in its container, from 0: the storage page shows them in it. */
        position: integer('position').notNull().default(0),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [
        index('storage_cases_container_id_idx').on(table.containerId),
        // The CSV files tell a case by its container and its name; 0013 renamed the duplicates.
        uniqueIndex('storage_cases_container_id_name_unique').on(table.containerId, table.name)
    ]
);

// Wine bottles table (individual bottle instances)
export const wineBottles = sqliteTable(
    'wine_bottles',
    {
        id: id(),
        definitionId: text('definition_id')
            .references(() => wineDefinitions.id)
            .notNull(),
        vintage: integer('vintage'),
        optimum: integer('optimum'),
        // The drinking window, « à partir de » and « avant fin », each YYYY or YYYY-MM
        // (src/lib/shared/drinking.ts).
        drinkFrom: text('drink_from'),
        drinkBefore: text('drink_before'),
        originId: text('origin_id').references(() => origins.id),
        formatId: text('format_id')
            .references(() => wineFormats.id)
            .notNull(),
        barcode: text('barcode'),
        purchasePrice: real('purchase_price'),
        purchaseDate: integer('purchase_date', { mode: 'timestamp' }),
        currentValue: real('current_value'),
        currentValueDate: integer('current_value_date', { mode: 'timestamp' }),
        storageCaseId: text('storage_case_id').references(() => storageCases.id, {
            onDelete: 'set null'
        }),
        notes: text('notes'),
        availability: text('availability')
            .$type<BottleAvailability>()
            .notNull()
            .default(BottleAvailability.AVAILABLE),
        consumedDate: integer('consumed_date', { mode: 'timestamp' }),
        createdAt: timestamp('created_at'),
        updatedAt: timestamp('updated_at')
    },
    (table) => [
        // Several bottles may have no barcode.
        uniqueIndex('wine_bottles_barcode_unique')
            .on(table.barcode)
            .where(sql`${table.barcode} IS NOT NULL`),
        index('wine_bottles_definition_id_idx').on(table.definitionId),
        index('wine_bottles_origin_id_idx').on(table.originId),
        index('wine_bottles_format_id_idx').on(table.formatId),
        index('wine_bottles_storage_case_id_idx').on(table.storageCaseId),
        check('wine_bottles_availability_check', sql.raw(`availability IN (${AVAILABILITIES})`))
    ]
);

// App settings table (stores application configuration)
export const appSettings = sqliteTable('app_settings', {
    id: id(),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Login sessions. Only a SHA-256 hash of the cookie token is stored, so the database file and the
// backups that copy it cannot be turned back into a valid cookie.
export const sessions = sqliteTable('sessions', {
    tokenHash: text('token_hash').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// Label presets table (stores barcode/QR code label generation settings)
export const labelPresets = sqliteTable('label_presets', {
    id: id(),
    name: text('name').notNull().unique(),
    description: text('description'),
    pageFormat: text('page_format').notNull().$type<PageFormat>(),
    labelWidth: real('label_width').notNull(), // in mm
    labelHeight: real('label_height').notNull(), // in mm
    marginTop: real('margin_top').notNull(), // in mm
    marginLeft: real('margin_left').notNull(), // in mm
    marginBottom: real('margin_bottom').notNull(), // in mm
    marginRight: real('margin_right').notNull(), // in mm
    padding: real('padding').notNull(), // in mm - for backward compatibility
    labelPadding: real('label_padding'), // in mm - padding inside each label
    horizontalSpacing: real('horizontal_spacing'), // in mm - gap between labels horizontally
    verticalSpacing: real('vertical_spacing'), // in mm - gap between labels vertically
    codeType: text('code_type').notNull().$type<CodeType>(),
    showCodeValue: integer('show_code_value', { mode: 'boolean' }).notNull(),
    showBorder: integer('show_border', { mode: 'boolean' }).notNull().default(false),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

// Export types for TypeScript
export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Appellation = typeof appellations.$inferSelect;
export type NewAppellation = typeof appellations.$inferInsert;
export type Producer = typeof producers.$inferSelect;
export type WineDefinition = typeof wineDefinitions.$inferSelect;
export type NewWineDefinition = typeof wineDefinitions.$inferInsert;
export type WineType = typeof wineTypes.$inferSelect;
export type NewWineType = typeof wineTypes.$inferInsert;
export type WineColor = typeof wineColors.$inferSelect;
export type NewWineColor = typeof wineColors.$inferInsert;
export type WineClassification = typeof wineClassifications.$inferSelect;
export type NewWineClassification = typeof wineClassifications.$inferInsert;
export type WineFormat = typeof wineFormats.$inferSelect;
export type NewWineFormat = typeof wineFormats.$inferInsert;
export type WineBottle = typeof wineBottles.$inferSelect;
export type NewWineBottle = typeof wineBottles.$inferInsert;
export type Origin = typeof origins.$inferSelect;
export type NewOrigin = typeof origins.$inferInsert;
export type StorageContainer = typeof storageContainers.$inferSelect;
export type NewStorageContainer = typeof storageContainers.$inferInsert;
export type StorageCase = typeof storageCases.$inferSelect;
export type NewStorageCase = typeof storageCases.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
export type LabelPreset = typeof labelPresets.$inferSelect;
export type NewLabelPreset = typeof labelPresets.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type WineImage = typeof wineImages.$inferSelect;
export type Wish = typeof wishes.$inferSelect;
