import { randomUUID } from 'node:crypto';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Tx } from '#lib/server/db/connection.js';
import { isConstraintRefusal } from '#lib/server/db-errors.js';
import { ConflictError } from '#lib/server/http/errors.js';
import { EXPORT_TABLES } from '#lib/server/features/backup/export.js';
import {
    importedRow,
    type ColumnProblem,
    type ImportedRow
} from '#lib/server/features/shared/imported-rows.js';
import { normalized } from '#lib/server/features/shared/names.js';
import { nextCasePositions, touchContainer } from '#lib/server/features/storage/repository.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { BottleImport } from './bottles';
import { csvValues, UnevenLine, type CsvLines, type CsvRecord } from './parse';
import type { ReferenceIndex, Row } from './referenceIndex';
import type { Attempts, Review, RowChoice, RowOfFile } from './review';
import { parentOf, TABLES, type TableName } from './tables';

/**
 * Why a row is left out, as a code and values that the client words in the user's language. A
 * whole file can be left out too, as row 0: one without a table name, or not CSV.
 */
export type RowProblem =
    | ColumnProblem
    | { code: 'unknown_reference'; column: string; name: string }
    /** In a review, a producer that the cellar lacks, close to some it has. */
    | { code: 'similar_name'; column: string; name: string; similar: string[] }
    | { code: 'unknown_wine'; name: string }
    | { code: 'several_wines'; name: string }
    | { code: 'case_full'; name: string; capacity: number }
    | { code: 'uneven_row'; values: number; columns: number }
    | { code: 'no_table' }
    | { code: 'not_csv'; line?: number };

/** Why a row is already in the cellar: a row of the same name, or a bottle of the same barcode. */
export type SkipReason =
    | { code: 'same_name'; name: string }
    | { code: 'same_barcode'; barcode: string }
    | { code: 'same_bottle' };

type RowError = { row: number; problems: RowProblem[] };
/** A row already in the cellar; `imported` when the review answered to import it anyway. */
type RowSkipped = { row: number; reason: SkipReason; imported?: true };
/** A row that the review answered to leave out: the key of that answer, and the row as read. */
type RowIgnored = { row: number; key: string; values: string[] };

/**
 * The most rows of each kind that a report lists: a large file of rows already in the cellar
 * would make an answer too large to send, after the import is written.
 */
const LISTED_ROWS = 1000;

/** The rows of a file of one kind, such as those in error: all counted, the first ones listed. */
class ReportedRows<Row> {
    count = 0;
    readonly list: Row[] = [];

    add(row: Row, counted = true): void {
        if (counted) this.count += 1;
        if (this.list.length < LISTED_ROWS) this.list.push(row);
    }
}

/**
 * What became of the rows of a file, numbered from 1 under the header: those left out for what
 * they lack or break (errors), and those already in the cellar (skipped). `table` is the table
 * that the name of the file names, if any.
 */
function fileReport(
    table: TableName | null,
    file: string,
    {
        columns = [] as string[],
        totalRows = 0,
        imported = 0,
        errors = new ReportedRows<RowError>(),
        skipped = new ReportedRows<RowSkipped>(),
        ignored = [] as RowIgnored[]
    }
) {
    return {
        table,
        file,
        columns,
        totalRows,
        successfulImports: imported,
        skippedImports: skipped.count,
        failedImports: errors.count,
        ignoredImports: ignored.length,
        errors: errors.list,
        skipped: skipped.list,
        // Every one, for the user to download them.
        ignored
    };
}

export type FileReport = ReturnType<typeof fileReport>;

/** The report of a file left out whole, as its row 0. */
export function fileLeftOut(table: TableName | null, file: string, problem: RowProblem) {
    const errors = new ReportedRows<RowError>();
    errors.add({ row: 0, problems: [problem] });
    return fileReport(table, file, { errors });
}

type Added = { imported: Row; kept?: SkipReason } | { failed: RowProblem[] };
export type Outcome = Added | { skipped: SkipReason };
type Insert = (table: TableName, row: ImportedRow) => Row;

/**
 * The cases that a file adds to the containers. One without a position goes after the last case of
 * its container, when the container had cases before: files from 0.7.0 or earlier give no position,
 * and the cases they add to a new container keep the order of those versions.
 */
class ImportedCases {
    private next: Map<string, number>;

    constructor(private tx: Tx) {
        this.next = nextCasePositions(tx);
    }

    /** The row with its position, once its container is marked changed. */
    place(row: ImportedRow): ImportedRow {
        const containerId = row.containerId as string;
        // A container dialog opened before the import must not delete the case.
        touchContainer(containerId, this.tx);
        const next = this.next.get(containerId);
        if (next === undefined) return row;
        const position = (row.position as number | undefined) ?? next;
        this.next.set(containerId, Math.max(next, position + 1));
        return { ...row, position };
    }
}

type Context = {
    index: ReferenceIndex;
    insert: Insert;
    cases?: ImportedCases;
    /** The review, when the import has one. */
    review?: Review;
    /** The row of the file being imported. */
    at: RowOfFile;
};

/** A row that the import adds for a reference, once the row that names it is added too. */
type Created = { table: TableName; row: ImportedRow };

/**
 * The id of each row that `record` names, and the rows to add for those that do not exist yet and
 * are created from their name. A row named that does not exist otherwise leaves the record out,
 * even when the reference is optional: imported without it, the record would not be recognised at
 * the next import, and would be added again.
 */
function referencedIds(
    table: TableName,
    record: CsvRecord,
    { index, review }: Context,
    choice: RowChoice = {}
): { ids: Record<string, string | null>; created: Created[] } | { failed: RowProblem[] } {
    const ids: Record<string, string | null> = {};
    const created: Created[] = [];
    for (const [column, reference] of Object.entries(TABLES[table].references ?? {})) {
        const name = record[reference.csvColumn] ?? '';
        if (name === '') {
            if (reference.required) {
                return { failed: [{ code: 'missing', column: reference.csvColumn }] };
            }
            ids[column] = null;
        } else if (reference.table === 'wineDefinitions') {
            const wine = choice.wine ?? index.wineOfBottle(record);
            if (typeof wine === 'string') return { failed: [{ code: wine, name }] };
            ids[column] = wine.id;
        } else {
            // The file may give the parent of the row named (as regionName for an appellation):
            // the row is then looked for under it.
            const parentColumn = parentOf(reference.table)?.reference.csvColumn;
            const parentName = parentColumn && record[parentColumn];
            const row = index.find(
                reference.table,
                name,
                parentName ? { name: parentName } : undefined
            );
            const similar =
                !row && review && reference.table === 'producers'
                    ? index.closeNames(reference.table, name)
                    : [];
            if (row) {
                ids[column] = row.id;
            } else if (similar.length > 0) {
                // A review asks before it adds a producer that may be one the cellar has.
                return {
                    failed: [{ code: 'similar_name', column: reference.csvColumn, name, similar }]
                };
            } else if (reference.created) {
                const checked = importedRow(reference.table, {
                    [TABLES[reference.table].nameColumn!]: name
                });
                if ('problems' in checked) {
                    // The problem is in the column of the file, not in that of the row created.
                    const problems = checked.problems.map((problem) => ({
                        ...problem,
                        column: reference.csvColumn
                    }));
                    return { failed: problems };
                }
                const id = randomUUID();
                ids[column] = id;
                created.push({ table: reference.table, row: { ...checked.row, id } });
            } else {
                // The parent is named too: the cellar may have a row of this name elsewhere.
                const named = parentName ? `${name} (${parentName})` : name;
                return {
                    failed: [
                        { code: 'unknown_reference', column: reference.csvColumn, name: named }
                    ]
                };
            }
        }
    }
    return { ids, created };
}

/**
 * Imports a row that is not a bottle. It is checked before it is found in the cellar, so that an
 * invalid row is reported as such. A wine row is recorded first, even when it is left out: the
 * bottles of a wine that the file gives twice are reported.
 */
function importRow(table: TableName, record: CsvRecord, context: Context): Outcome {
    const isWine = table === 'wineDefinitions';
    const wine = isWine ? context.index.recordWineRow(record, context.at) : undefined;
    const references = referencedIds(table, record, context);
    if ('failed' in references) return references;
    // A producer's region gives its country, as the API places it (placed() in
    // features/producers/service.ts): a file may name the region only.
    const { regionId } = references.ids;
    if (table === 'producers' && regionId) {
        references.ids.countryId = context.index.countryOfRegion(regionId) ?? null;
    }
    const checked = importedRow(table, { ...csvValues(record), ...references.ids });
    if ('problems' in checked) return { failed: checked.problems };

    const nameColumn = TABLES[table].nameColumn ?? 'name';
    const parent = parentOf(table);
    const existing = isWine
        ? wine
        : context.index.find(
              table,
              record[nameColumn] ?? '',
              parent && { id: references.ids[parent.column]! }
          );
    if (existing) return { skipped: { code: 'same_name', name: String(existing[nameColumn]) } };

    for (const created of references.created) context.insert(created.table, created.row);
    const imported = context.insert(table, context.cases?.place(checked.row) ?? checked.row);
    if (isWine) context.index.recordImportedWine(record, imported, context.at);
    return { imported };
}

function importBottle(
    record: CsvRecord,
    bottles: BottleImport,
    context: Context,
    choice: RowChoice = {}
): Outcome {
    let references = referencedIds('wineBottles', record, context, choice);
    // A consumed bottle keeps the case it was in, without taking a place there, but that case may
    // be gone, or its container: it is then imported in no case rather than refused.
    const drunkCaseGone =
        normalized(record.availability) === BottleAvailability.CONSUMED &&
        'failed' in references &&
        references.failed.every(
            (problem) => 'column' in problem && problem.column === 'storageCaseName'
        );
    if (drunkCaseGone) {
        references = referencedIds(
            'wineBottles',
            { ...record, storageCaseName: '' },
            context,
            choice
        );
    }
    if ('failed' in references) {
        return (!choice.keep && twinBottle(record, bottles, context)) || references;
    }
    const checked = importedRow('wineBottles', { ...csvValues(record), ...references.ids });
    if ('problems' in checked) return { failed: checked.problems };
    if (choice.keep) {
        // A barcode is unique: the bottle kept although the cellar has its barcode takes another,
        // or none.
        if (bottles.barcodeTaken(checked.row)) checked.row.barcode = null;
    } else {
        const duplicate = bottles.duplicate(checked.row);
        if (duplicate) return { skipped: duplicate };
    }
    const caseFull = bottles.caseFull(checked.row);
    if (caseFull) return { failed: [caseFull] };
    const bottle = context.insert('wineBottles', bottles.withBarcode(checked.row));
    bottles.added(bottle);
    return { imported: bottle };
}

/**
 * A bottle of twins, wines of the cellar that a file cannot tell apart (BUG-18), which one of them
 * already has, as when the export of the cellar is imported again: already in the cellar, rather
 * than a bottle whose wine is to choose.
 */
function twinBottle(record: CsvRecord, bottles: BottleImport, context: Context) {
    const bottle = bottleOfTwin(record, bottles, context);
    return bottle && { skipped: bottles.duplicate(bottle)! };
}

/** The bottle of twins that one of them already has, as the file gives it, if any. */
function bottleOfTwin(record: CsvRecord, bottles: BottleImport, context: Context) {
    if (context.index.wineOfBottle(record) !== 'several_wines') return undefined;
    for (const wine of context.index.winesOfBottle(record)) {
        const references = referencedIds('wineBottles', record, context, { wine });
        if ('failed' in references) return undefined;
        const checked = importedRow('wineBottles', { ...csvValues(record), ...references.ids });
        if ('problems' in checked) return undefined;
        if (bottles.has(checked.row)) return checked.row;
    }
    return undefined;
}

/**
 * Imports the lines of the file `file` into `table`, in the transaction `tx`, with the answers of
 * the review if the import has one.
 */
export function importFile(
    tx: Tx,
    index: ReferenceIndex,
    { file, table, header, lines }: { file: string; table: TableName } & CsvLines,
    overrideAllBarcodes: boolean,
    review?: Review
): FileReport {
    const errors = new ReportedRows<RowError>();
    const skipped = new ReportedRows<RowSkipped>();
    const ignored: RowIgnored[] = [];
    let imported = 0;
    const records = lines.filter((line): line is CsvRecord => !(line instanceof UnevenLine));
    const bottles =
        table === 'wineBottles'
            ? new BottleImport(tx, index.ids('storageCases'), records, overrideAllBarcodes)
            : undefined;
    let rowNumber = 0;
    const insert: Insert = (table, row) => {
        let inserted: Row;
        try {
            [inserted] = tx
                .insert(EXPORT_TABLES[table] as SQLiteTable)
                .values(row)
                .returning()
                .all() as Row[];
        } catch (error) {
            if (!isConstraintRefusal(error)) throw error;
            // better-sqlite3 rolls the whole import back.
            const where = `${file}, row ${rowNumber}`;
            throw new ConflictError(
                'import_row_refused',
                `Nothing was imported: ${where}: ${(error as Error).message}`,
                { file, row: rowNumber }
            );
        }
        index.add(table, inserted);
        return inserted;
    };
    const cases = table === 'storageCases' ? new ImportedCases(tx) : undefined;
    const context: Context = { index, insert, cases, review, at: { file, row: 0 } };
    const attempt = (record: CsvRecord, choice: RowChoice): Outcome =>
        bottles
            ? importBottle(record, bottles, context, choice)
            : importRow(table, record, context);
    const attempts: Attempts = {
        attempt,
        create: (target, name, parent) => createNamed(target, name, parent, context),
        wine: (choice) => index.wineOfChoice(choice),
        wineKey: (record) => index.bottleWineKey(record),
        winesOf: (record) => index.wineOptions(record),
        pendingWine: (record) => index.pendingWine(record),
        twinInCellar: (record) => !!bottles && !!bottleOfTwin(record, bottles, context),
        closeNames: (target, name) => index.closeNames(target, name)
    };
    for (const line of lines) {
        rowNumber += 1;
        context.at = { file, row: rowNumber };
        const outcome = review
            ? review.settle(table, context.at, line, attempts)
            : line instanceof UnevenLine
              ? { failed: [unevenRow(line)] }
              : attempt(line, {});
        if ('ignored' in outcome) {
            const values = line instanceof UnevenLine ? line.values : header.map((c) => line[c]);
            ignored.push({ row: rowNumber, key: outcome.ignored, values });
        } else if ('skipped' in outcome) {
            skipped.add({ row: rowNumber, reason: outcome.skipped });
        } else if ('failed' in outcome) {
            errors.add({ row: rowNumber, problems: outcome.failed });
        } else {
            imported += 1;
            if (outcome.kept) {
                skipped.add({ row: rowNumber, reason: outcome.kept, imported: true }, false);
            }
        }
    }
    bottles?.finish();
    return fileReport(table, file, {
        columns: header,
        totalRows: lines.length,
        imported,
        errors,
        skipped,
        ignored
    });
}

export const unevenRow = (line: UnevenLine): RowProblem => ({
    code: 'uneven_row',
    values: line.values.length,
    columns: line.columns
});

/**
 * Creates the row of `table` named `name`, within the parent named `parent`, as a file of the table
 * would give it, unless the cellar or the import has it already. Returns its problems, if any.
 */
function createNamed(
    table: TableName,
    name: string,
    parent: string | undefined,
    context: Context
): RowProblem[] | undefined {
    const of = parentOf(table);
    if (context.index.find(table, name, parent && of ? { name: parent } : undefined)) return;
    const record: CsvRecord = { [TABLES[table].nameColumn!]: name };
    if (of && parent) record[of.reference.csvColumn] = parent;
    const outcome = importRow(table, record, context);
    return 'failed' in outcome ? outcome.failed : undefined;
}
