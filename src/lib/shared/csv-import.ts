/**
 * The table that a CSV file holds, from its name: the one of `tables` that ends last in it,
 * whatever the case. An export is named `cellar-export-<name chosen>-<table>-<time>.csv`, and the
 * name chosen may hold another table name, such as "regions". The admin page reads the names of
 * the files chosen with the tables that the server gives it, as the import reads them.
 */
export function tableOfFile<Table extends string>(
    fileName: string,
    tables: readonly Table[]
): Table | undefined {
    const name = fileName.toLowerCase();
    let found: Table | undefined;
    let foundEnd = -1;
    for (const table of tables) {
        const start = name.lastIndexOf(table.toLowerCase());
        if (start !== -1 && start + table.length > foundEnd) {
            found = table;
            foundEnd = start + table.length;
        }
    }
    return found;
}

/**
 * The key of the answer to one row of a CSV import in its review, numbered from 1 under the header
 * of `file`: to ignore it, or to import a bottle that the cellar has already.
 */
export const csvRowKey = (file: string, row: number) => JSON.stringify(['row', file, row]);

/** The key of the answer that settles every problem of a review left without one: by ignoring. */
export const CSV_OTHERS_KEY = '*';
