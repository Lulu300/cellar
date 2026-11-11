import { z } from 'zod';
import { db } from '#lib/server/db/index.js';
import { debugLogger } from '#lib/server/debug.js';
import { tooLargeError } from '#lib/server/http/errors.js';
import { rowColumns } from '#lib/server/features/shared/imported-rows.js';
import { tableOfFile } from '#lib/shared/csv-import.js';
import { isIdColumn, parseCsv, type CsvRecord, type UnevenLine } from './parse';
import { ReferenceIndex, WINE_COLUMNS } from './referenceIndex';
import { fileLeftOut, importFile, type FileReport } from './pipeline';
import { IMPORT_ORDER, parentOf, TABLES, type TableName } from './tables';

const debug = debugLogger('csv-import');

/** The largest upload of CSV files: far above a cellar of tens of thousands of bottles. */
export const MAX_CSV_UPLOAD_BYTES = 50 * 1024 * 1024;

const csvFile = z
    .file()
    .refine((file) => /\.csv$/i.test(file.name), 'Only CSV files are supported');

/** The form of an import: the files, each named after its table, and the options. */
export const csvImportForm = z.object({
    files: z.array(csvFile).min(1),
    delimiter: z.string().min(1).max(5).default(','),
    /** With automatic barcodes, every bottle gets a new one, even those that the file gives. */
    overrideAllBarcodes: z.stringbool().default(false),
    /** Answers the report of the import without writing anything. */
    dryRun: z.stringbool().default(false)
});

type CsvImport = z.output<typeof csvImportForm>;
type ReadFile =
    { file: string; table: TableName; lines: (CsvRecord | UnevenLine)[] } | { report: FileReport };

async function readFile(file: File, delimiter: string): Promise<ReadFile> {
    const table = tableOfFile(file.name, IMPORT_ORDER);
    // The name has no table name, such as wineBottles.csv.
    if (!table) return { report: fileLeftOut(null, file.name, { code: 'no_table' }) };
    try {
        return { file: file.name, table, lines: parseCsv(await file.text(), delimiter) };
    } catch (error) {
        debug(`${file.name} is not CSV:`, error);
        // csv-parse tells the line where the file stops being CSV.
        const { lines } = error as { lines?: number };
        return { report: fileLeftOut(table, file.name, { code: 'not_csv', line: lines }) };
    }
}

const orderOf = (read: ReadFile) => ('table' in read ? IMPORT_ORDER.indexOf(read.table) : -1);

/** Rolls the import back once its report is made. */
class DryRun extends Error {
    constructor(readonly reports: FileReport[]) {
        super('Dry run');
    }
}

/**
 * Imports CSV files into their tables, each after those it refers to, in one transaction. A row
 * that lacks something, or names a row the cellar does not have, is left out and reported; a row
 * that the database refuses cancels the whole import.
 */
export async function importCsv({ files, delimiter, overrideAllBarcodes, dryRun }: CsvImport) {
    if (files.reduce((size, file) => size + file.size, 0) > MAX_CSV_UPLOAD_BYTES) {
        throw tooLargeError();
    }
    const read = (await Promise.all(files.map((file) => readFile(file, delimiter)))).sort(
        (a, b) => orderOf(a) - orderOf(b)
    );
    const started = performance.now();
    let results: FileReport[];
    try {
        results = db.transaction((tx) => {
            const index = new ReferenceIndex(tx);
            const reports = read.map((file) =>
                'report' in file ? file.report : importFile(tx, index, file, overrideAllBarcodes)
            );
            if (dryRun) throw new DryRun(reports);
            return reports;
        });
    } catch (error) {
        if (!(error instanceof DryRun)) throw error;
        results = error.reports;
    }
    for (const result of results) debug(result);
    debug(`${dryRun ? 'Checked' : 'Imported'} in ${Math.round(performance.now() - started)} ms`);

    const total = (count: (result: FileReport) => number) =>
        results.reduce((sum, result) => sum + count(result), 0);
    const summary = {
        totalImported: total((result) => result.successfulImports),
        totalSkipped: total((result) => result.skippedImports),
        totalFailed: total((result) => result.failedImports),
        filesProcessed: files.length
    };
    return {
        success: true,
        dryRun,
        message: `CSV import ${dryRun ? 'checked, nothing written' : 'completed'}: ${summary.totalImported} records imported, ${summary.totalSkipped} already in the cellar, ${summary.totalFailed} failed.`,
        results,
        summary
    };
}

/**
 * How far down the import order a table comes: 1 for a table that refers to none, otherwise one
 * more than the furthest of those it refers to.
 */
function priorityOf(table: TableName): number {
    const references = Object.values(TABLES[table].references ?? {});
    return 1 + Math.max(0, ...references.map((reference) => priorityOf(reference.table)));
}

/**
 * The columns of a file of `table` that the import reads: those of the row, ids aside, and the
 * names of the rows it refers to.
 */
function columnsOf(table: TableName): { name: string; required: boolean }[] {
    const references = TABLES[table].references ?? {};
    const columns = Object.entries(rowColumns(table)).flatMap(([column, rule]) => {
        const reference = references[column];
        if (!reference) {
            // An id that is not a reference, such as the parent of a container, is never read.
            if (isIdColumn(column)) return [];
            return [{ name: column, required: !rule.safeParse(undefined).success }];
        }
        // A wine is named by more than its name, and a region within its country.
        const parent = parentOf(reference.table)?.reference.csvColumn;
        const naming =
            reference.table === 'wineDefinitions' ? WINE_COLUMNS : parent ? [parent] : [];
        return [
            { name: reference.csvColumn, required: reference.required },
            ...naming.map((name) => ({ name, required: false }))
        ];
    });
    // A column may come twice, such as the producer of a wine, which names its producerId, and
    // the country of a producer, which also names the country of its region.
    const required = new Map<string, boolean>();
    for (const column of columns) {
        required.set(column.name, required.get(column.name) || column.required);
    }
    return [...required].map(([name, required]) => ({ name, required }));
}

/**
 * The tables that the CSV import reads, by priority, which is an order of the import, with the
 * columns of their files: for the guide of the admin page, which also tells the table of the files
 * chosen by their names.
 */
export function csvImportTables() {
    return IMPORT_ORDER.map((table) => ({
        table,
        priority: priorityOf(table),
        columns: columnsOf(table)
    })).toSorted((a, b) => a.priority - b.priority);
}
