import { mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ZipSource } from '#lib/server/http/body.js';
import { extractZip, InvalidZipError } from '#lib/server/zip.js';
import { OperationFailedError, ValidationError, type ApiError } from '#lib/server/http/errors.js';
import { holdWrites } from '#lib/server/write-gate.js';
import { brokenRule, isConstraintRefusal, isForeignKeyRefusal } from '#lib/server/db-errors.js';
import {
    importedRow,
    withNamesCut,
    type ImportedRow
} from '#lib/server/features/shared/imported-rows.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { backupTimestamp } from './archive';
import { createExportZip, EXPORT_TABLE_NAMES, EXPORT_TABLES, type ExportTableName } from './export';
import { safetyFileName } from './files';
import { replaceCellar, type TableRows } from './repository';
import { isBackupImageEntry } from './restore';
import { copyImages, zipPathOf } from './service';

/**
 * The ValidationError for a file that is not an export this version can import. `problem` lets the
 * UI say why in its language; `reason` says it in English, for scripts and logs.
 */
function invalidExport(problem: string, reason: string, values: Record<string, unknown> = {}) {
    return new ValidationError('invalid_export', `Invalid export: ${reason}`, {
        problem,
        ...values,
        reason
    });
}

/** The tables that exports made before 1.3.0 lack, which their import leaves empty. */
const ADDED_IN_1_3: ExportTableName[] = ['winePhotos', 'wishes'];

/** The rows of an export that the database refuses, by the rule they break. */
const REFUSED_ROWS: Record<string, string> = {
    duplicate_region: 'in regions, a country has two regions of the same name',
    duplicate_appellation: 'in appellations, a region has two appellations of the same name',
    duplicate_barcode: 'in wineBottles, two bottles have the same barcode',
    duplicate_container: 'in storageContainers, two containers have the same name',
    duplicate_case: 'in storageCases, a container has two cases of the same name',
    missing_reference: 'a row refers to a row that the export lacks',
    other: 'the database refuses a row'
};

/** The 422 for an export whose rows the database refused, which left it as it was. */
function refusedExport(error: unknown): ApiError | undefined {
    if (!isConstraintRefusal(error)) return undefined;
    const broken = brokenRule(error) ?? (isForeignKeyRefusal(error) ? 'missing_reference' : '');
    const rule = broken in REFUSED_ROWS ? broken : 'other';
    return new ValidationError(
        'export_refused',
        `Import failed, your data was not changed: ${REFUSED_ROWS[rule]}. Restore a backup zip instead, which is repaired when restored, or fix the export.`,
        { rule, reason: (error as Error).message }
    );
}

const unreadableExport = (reason: string) =>
    invalidExport('unreadable', `It cannot be read: ${reason}.`);

/**
 * The JSON data and the extracted entries of an export zip. Only what is wrong with the file is a
 * 422: a disk error, such as a full disk or a folder the server cannot write to, stays a 500.
 */
async function readExport(zipPath: string, extractDir: string) {
    await mkdir(extractDir, { recursive: true });
    let extracted;
    try {
        extracted = await extractZip(
            zipPath,
            extractDir,
            (name) => name.endsWith('.json') || isBackupImageEntry(name)
        );
    } catch (error) {
        if (error instanceof InvalidZipError) throw unreadableExport(error.message);
        throw error;
    }
    const jsonName = extracted.findLast((name) => name.endsWith('.json'));
    if (!jsonName) throw unreadableExport('The zip holds no JSON export');
    const text = await readFile(path.join(extractDir, jsonName), 'utf-8');
    let json;
    try {
        json = JSON.parse(text);
    } catch (error) {
        throw unreadableExport((error as SyntaxError).message);
    }
    if (!json?.data || typeof json.data !== 'object')
        throw unreadableExport('The JSON has no data');
    return { json, extracted };
}

/**
 * A row of the export as the database takes it, with its id and timestamps: the other columns are
 * repaired and checked as the CSV import does.
 */
function exportRow(table: ExportTableName, value: unknown, index: number): ImportedRow {
    const row = (typeof value === 'object' && value !== null ? value : {}) as ImportedRow;
    const checked = importedRow(table, withNamesCut(table, row));
    if ('problem' in checked) {
        throw invalidExport('invalid_row', `row ${index + 1} of ${table}: ${checked.problem}.`, {
            table,
            row: index + 1,
            problems: checked.problems
        });
    }
    const date = (stamp: unknown) =>
        typeof stamp === 'string' || typeof stamp === 'number' ? new Date(stamp) : stamp;
    // null rather than undefined for a missing one: Drizzle would fill in a new id or the time of
    // the import, and the row would no longer be the one exported. The database refuses null.
    return {
        ...checked.row,
        id: row.id ?? null,
        createdAt: date(row.createdAt) ?? null,
        updatedAt: date(row.updatedAt) ?? null
    };
}

/** The tables of the export, in the order of EXPORT_TABLES, each after the tables it refers to. */
function exportTables(data: Record<string, unknown>): TableRows[] {
    // The import empties every table: one that the file lacks would stay empty. The automatic
    // exports made by older versions lack five tables, and those of the cron route lacked
    // wineImages too. Exports older than 1.3.0 lack winePhotos, as their wines had one image only,
    // and wishes, as they had no wishlist.
    const missing = EXPORT_TABLE_NAMES.filter(
        (name) => !ADDED_IN_1_3.includes(name) && !Array.isArray(data[name])
    );
    if (missing.length > 0) {
        throw invalidExport('incomplete', `It lacks ${missing.join(', ')}.`, {
            tables: missing.join(', ')
        });
    }
    const rows = (name: ExportTableName) => (data[name] ?? []) as unknown[];
    // The app never used the parent of a container; the database refuses one that is missing.
    const containerIds = new Set(rows('storageContainers').map((row) => (row as ImportedRow)?.id));
    return EXPORT_TABLE_NAMES.map((name) => ({
        name,
        table: EXPORT_TABLES[name],
        rows: rows(name).map((value, index) => {
            const row = exportRow(name, value, index);
            if (name === 'storageContainers' && !containerIds.has(row.parentContainerId)) {
                row.parentContainerId = null;
            }
            return row;
        })
    }));
}

/**
 * Saves the current data in a pre-import export, then replaces it with `tables`: on a failure,
 * nothing is imported and the backup is removed.
 */
async function backUpThenReplace(tables: TableRows[]) {
    // Last step before the import, so that no refusal leaves this backup behind. Blocking:
    // without it, the data that the import replaces could not be got back.
    const backupPath = path.join(DATA_DIR, safetyFileName('export', 'import', backupTimestamp()));
    try {
        await createExportZip(backupPath, 'pre-import-export');
    } catch (error) {
        // createExportZip removes the zip it may have started.
        console.error('Pre-import backup failed, nothing imported:', error);
        throw new OperationFailedError(
            'pre_import_backup_failed',
            'The current data could not be backed up, so nothing was imported.'
        );
    }
    try {
        return { importCount: replaceCellar(tables), backupPath };
    } catch (error) {
        // Nothing changed, so there is nothing to go back to.
        await rm(backupPath, { force: true });
        throw refusedExport(error) ?? error;
    }
}

/**
 * Replaces the cellar with the data of the export zip `source`, after a pre-import
 * export of the current data. Writes are held from that export to the end of the import, as a
 * restore does: a write in between would be in neither, and lost.
 */
export async function importJson(source: ZipSource) {
    const timestamp = backupTimestamp();
    const tempFile = `${DATA_DIR}/temp-import-${timestamp}.zip`;
    const extractDir = `${DATA_DIR}/temp-extract-import-${timestamp}`;
    try {
        const zipPath = await zipPathOf(source, tempFile);
        const { json, extracted } = await readExport(zipPath, extractDir);
        const tables = exportTables(json.data);
        const { outcome, images } = await holdWrites(async () => {
            const outcome = await backUpThenReplace(tables);
            return { outcome, images: await copyImages(extractDir, extracted, 'import') };
        });
        return {
            success: true,
            message: `JSON import completed successfully. ${outcome.importCount} records imported. Previous data exported as backup.${images.restored ? ' Images were also restored.' : ''}${images.copyFailed ? ' Its images could not be copied.' : ''}`,
            recordCount: outcome.importCount,
            exportedAt: json.exportedAt,
            version: json.version,
            restored: { database: true, images: images.restored },
            imagesCopyFailed: images.copyFailed,
            backup: path.basename(outcome.backupPath)
        };
    } finally {
        await rm(extractDir, { recursive: true, force: true });
        await rm(tempFile, { force: true });
    }
}
