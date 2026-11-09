import { eq } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '#lib/server/db/index.js';
import { seed } from '#lib/server/db/seed.js';
import {
    appellations,
    origins,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineClassifications,
    wineDefinitions,
    wineFormats,
    wineImages,
    wineTypes,
    wineColors
} from '#lib/server/db/schema.js';
import {
    appellationsWithRegion,
    regionsWithCountry
} from '#lib/server/features/geography/repository.js';
import { tidyWinePhotos } from '#lib/server/features/images/repository.js';
import { EXPORT_TABLE_NAMES, EXPORT_TABLES, type ExportTableName } from './export';

/**
 * Empties every table of the cellar, then puts the default reference data back, all or nothing:
 * should the default data fail to go back in, the cellar stays as it was. app_settings,
 * label_presets and sessions are kept.
 */
export function wipeCellar(): void {
    db.transaction((tx) => {
        // Children first.
        for (const name of [...EXPORT_TABLE_NAMES].reverse()) {
            tx.delete(EXPORT_TABLES[name]).run();
        }
        seed(tx, { force: true });
    });
}

/** The rows of a table of an export, as the database takes them. */
export interface TableRows {
    name: ExportTableName;
    table: SQLiteTable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows of any table, which the import has checked and converted column by column
    rows: any[];
}

// In batches, to stay below SQLite's limit of variables per statement.
const BATCH_SIZE = 500;

/**
 * Replaces the rows of every table of the cellar with `tables`, given in the order of
 * EXPORT_TABLES, all or nothing: a failed insert leaves the database as it was. Returns the
 * number of rows inserted.
 */
export function replaceCellar(tables: TableRows[]): number {
    return db.transaction((tx) => {
        for (const { table } of [...tables].reverse()) tx.delete(table).run();

        let inserted = 0;
        for (const { name, table, rows } of tables) {
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                tx.insert(table)
                    .values(rows.slice(i, i + BATCH_SIZE))
                    .run();
            }
            inserted += rows.length;
            console.log(`Imported ${rows.length} records into ${name}`);
        }
        // An export written by hand may give a wine other photos without a main one, or its main
        // photo among its others, which the wine page would show twice.
        tidyWinePhotos(tx);
        return inserted;
    });
}

/**
 * The rows of a table for a CSV export, with the names of the rows that they refer to next to
 * their ids, which the export leaves out.
 */
export function csvExportRows(name: ExportTableName): Record<string, unknown>[] {
    switch (name) {
        case 'regions':
            return regionsWithCountry(db).all();
        case 'appellations':
            return appellationsWithRegion(db).all();
        case 'storageCases':
            return db
                .select({
                    id: storageCases.id,
                    name: storageCases.name,
                    capacity: storageCases.capacity,
                    position: storageCases.position,
                    containerId: storageCases.containerId,
                    containerName: storageContainers.name,
                    createdAt: storageCases.createdAt,
                    updatedAt: storageCases.updatedAt
                })
                .from(storageCases)
                .leftJoin(storageContainers, eq(storageCases.containerId, storageContainers.id))
                .all();
        case 'wineDefinitions':
            return db
                .select({
                    id: wineDefinitions.id,
                    name: wineDefinitions.name,
                    producer: wineDefinitions.producer,
                    appellationId: wineDefinitions.appellationId,
                    appellationName: appellations.name,
                    regionName: regions.name,
                    classificationId: wineDefinitions.classificationId,
                    classificationName: wineClassifications.name,
                    typeId: wineDefinitions.typeId,
                    typeName: wineTypes.type,
                    colorId: wineDefinitions.colorId,
                    colorName: wineColors.color,
                    rating: wineDefinitions.rating,
                    website: wineDefinitions.website,
                    description: wineDefinitions.description,
                    imageId: wineDefinitions.imageId,
                    imageName: wineImages.filename,
                    grapeVarieties: wineDefinitions.grapeVarieties,
                    targetQuantity: wineDefinitions.targetQuantity,
                    createdAt: wineDefinitions.createdAt,
                    updatedAt: wineDefinitions.updatedAt
                })
                .from(wineDefinitions)
                .leftJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
                .leftJoin(regions, eq(appellations.regionId, regions.id))
                .leftJoin(
                    wineClassifications,
                    eq(wineDefinitions.classificationId, wineClassifications.id)
                )
                .leftJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
                .leftJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
                .leftJoin(wineImages, eq(wineDefinitions.imageId, wineImages.id))
                .all();
        case 'wineBottles':
            return db
                .select({
                    id: wineBottles.id,
                    definitionId: wineBottles.definitionId,
                    // The columns that tell a wine apart, as in the wine file.
                    wineName: wineDefinitions.name,
                    producer: wineDefinitions.producer,
                    appellationName: appellations.name,
                    classificationName: wineClassifications.name,
                    typeName: wineTypes.type,
                    colorName: wineColors.color,
                    vintage: wineBottles.vintage,
                    optimum: wineBottles.optimum,
                    drinkFrom: wineBottles.drinkFrom,
                    drinkBefore: wineBottles.drinkBefore,
                    originId: wineBottles.originId,
                    originName: origins.name,
                    formatId: wineBottles.formatId,
                    formatName: wineFormats.name,
                    barcode: wineBottles.barcode,
                    purchasePrice: wineBottles.purchasePrice,
                    purchaseDate: wineBottles.purchaseDate,
                    currentValue: wineBottles.currentValue,
                    currentValueDate: wineBottles.currentValueDate,
                    storageCaseId: wineBottles.storageCaseId,
                    // A case is named within its container.
                    containerName: storageContainers.name,
                    storageCaseName: storageCases.name,
                    notes: wineBottles.notes,
                    availability: wineBottles.availability,
                    consumedDate: wineBottles.consumedDate,
                    createdAt: wineBottles.createdAt,
                    updatedAt: wineBottles.updatedAt
                })
                .from(wineBottles)
                .leftJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
                .leftJoin(appellations, eq(wineDefinitions.appellationId, appellations.id))
                .leftJoin(
                    wineClassifications,
                    eq(wineDefinitions.classificationId, wineClassifications.id)
                )
                .leftJoin(wineTypes, eq(wineDefinitions.typeId, wineTypes.id))
                .leftJoin(wineColors, eq(wineDefinitions.colorId, wineColors.id))
                .leftJoin(origins, eq(wineBottles.originId, origins.id))
                .leftJoin(wineFormats, eq(wineBottles.formatId, wineFormats.id))
                .leftJoin(storageCases, eq(wineBottles.storageCaseId, storageCases.id))
                .leftJoin(storageContainers, eq(storageCases.containerId, storageContainers.id))
                .all();
        default:
            return db.select().from(EXPORT_TABLES[name]).all();
    }
}
