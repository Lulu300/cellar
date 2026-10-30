import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    origins,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineImages,
    wineTypes
} from '#lib/server/db/schema.js';
import { writeZipWithImages } from '#lib/server/features/backup/archive.js';

/**
 * The tables of a JSON export, each after those it refers to: the import inserts them in this
 * order and empties them in the reverse one. Every export holds all of them, and the import
 * refuses an export that lacks one, since it empties them all.
 */
export const EXPORT_TABLES = {
    countries,
    regions,
    appellations,
    wineClassifications,
    wineTypes,
    wineColors,
    wineFormats,
    origins,
    storageContainers,
    storageCases,
    wineImages,
    wineDefinitions,
    wineBottles
};

export type ExportTableName = keyof typeof EXPORT_TABLES;

export const EXPORT_TABLE_NAMES = Object.keys(EXPORT_TABLES) as ExportTableName[];

/**
 * Writes an export to `zipPath`: the rows of every exported table in cellar-export.json, and the
 * images in images/. Returns the number of rows, and whether an import from the admin page would
 * take it.
 */
export async function createExportZip(zipPath: string, backupType: string) {
    // In one read transaction, so that the tables agree with each other.
    const data = db.transaction((tx) =>
        Object.fromEntries(
            EXPORT_TABLE_NAMES.map((name) => [name, tx.select().from(EXPORT_TABLES[name]).all()])
        )
    );
    const json = { exportedAt: new Date().toISOString(), version: '1.0', backupType, data };

    const restorable = await writeZipWithImages(zipPath, (archive) => {
        archive.append(JSON.stringify(json, null, 2), { name: 'cellar-export.json' });
    });
    return {
        recordCount: Object.values(data).reduce((sum, rows) => sum + rows.length, 0),
        restorable
    };
}
