import type { ExportTableName } from '#lib/server/features/backup/export.js';

export type TableName = ExportTableName;

/** An id column that a CSV file fills with the name of the row it refers to. */
interface Reference {
    table: TableName;
    /** The column of the file that names the row. */
    csvColumn: string;
    /** A row without it, or naming a row that does not exist, is reported and skipped. */
    required: boolean;
    /** A row that does not exist is created, from its name alone. */
    created?: boolean;
}

interface TableConfig {
    /** The column that names a row, which tells whether the cellar has it already. */
    nameColumn?: string;
    /**
     * The reference that a row is named within, such as the country of a region: two regions of
     * the same name in two countries are two regions.
     */
    parent?: string;
    references?: Record<string, Reference>;
}

const required = (table: TableName, csvColumn: string) => ({ table, csvColumn, required: true });
const optional = (table: TableName, csvColumn: string) => ({ table, csvColumn, required: false });

/**
 * Each table that the CSV import reads, as the CSV export writes it: the file of a table is named
 * after it (`wineBottles.csv`), and its references are names, since a file never gives ids.
 */
export const TABLES: Record<TableName, TableConfig> = {
    countries: { nameColumn: 'name' },
    regions: {
        nameColumn: 'name',
        parent: 'countryId',
        references: { countryId: required('countries', 'countryName') }
    },
    appellations: {
        nameColumn: 'name',
        parent: 'regionId',
        references: { regionId: required('regions', 'regionName') }
    },
    wineClassifications: { nameColumn: 'name' },
    wineTypes: { nameColumn: 'type' },
    wineColors: { nameColumn: 'color' },
    wineFormats: { nameColumn: 'name' },
    origins: { nameColumn: 'name' },
    storageContainers: { nameColumn: 'name' },
    storageCases: {
        nameColumn: 'name',
        parent: 'containerId',
        references: { containerId: required('storageContainers', 'containerName') }
    },
    wineImages: { nameColumn: 'filename' },
    // A wine is told apart by more than its name: see wineKey.
    wineDefinitions: {
        references: {
            appellationId: required('appellations', 'appellationName'),
            typeId: required('wineTypes', 'typeName'),
            colorId: required('wineColors', 'colorName'),
            classificationId: optional('wineClassifications', 'classificationName'),
            // The images are imported apart, as a zip.
            imageId: { ...optional('wineImages', 'imageName'), created: true }
        }
    },
    wineBottles: {
        references: {
            definitionId: required('wineDefinitions', 'wineName'),
            formatId: required('wineFormats', 'formatName'),
            originId: optional('origins', 'originName'),
            storageCaseId: optional('storageCases', 'storageCaseName')
        }
    }
};

/** The tables in an order where each comes after those it refers to. */
export const IMPORT_ORDER: TableName[] = [];
function addInOrder(table: TableName) {
    if (IMPORT_ORDER.includes(table)) return;
    for (const reference of Object.values(TABLES[table].references ?? {})) {
        addInOrder(reference.table);
    }
    IMPORT_ORDER.push(table);
}
(Object.keys(TABLES) as TableName[]).forEach(addInOrder);

/**
 * The reference that a row of `table` is named within, and the column of a file that names the
 * parent of a row of `table` it refers to, as the export writes it: the country of a region in
 * `countryName`, the region of an appellation in `regionName`.
 */
export function parentOf(table: TableName): { column: string; reference: Reference } | undefined {
    const { parent, references } = TABLES[table];
    return parent ? { column: parent, reference: references![parent] } : undefined;
}
