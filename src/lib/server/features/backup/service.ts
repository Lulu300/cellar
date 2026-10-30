import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { db, replaceDatabaseFile } from '#lib/server/db/index.js';
import { SeedingError } from '#lib/server/db/seed.js';
import type { Session } from '#lib/server/db/schema.js';
import { getStoredAccessCode, putBackAccessCode } from '#lib/server/access-code.js';
import { csvLine } from '#lib/server/csv.js';
import { getLastBarcodeNumbers } from '#lib/server/features/barcode/repository.js';
import { putBackLastBarcodeNumbers } from '#lib/server/features/barcode/service.js';
import { setAppSettings } from '#lib/server/features/settings/repository.js';
import type { ZipSource } from '#lib/server/http/body.js';
import {
    ConflictError,
    invalidField,
    NotFoundError,
    OperationFailedError,
    ValidationError
} from '#lib/server/http/errors.js';
import { DATA_DIR, resolveInDir } from '#lib/server/paths.js';
import { keepOnlySession } from '#lib/server/session.js';
import {
    checkRestoredDatabase,
    getUpgradeActionsSetting,
    putBackUpgradeState,
    UpgradeRefusal
} from '#lib/server/upgrade.js';
import { holdWrites } from '#lib/server/write-gate.js';
import { extractZip, InvalidZipError } from '#lib/server/zip.js';
import { backupTimestamp, createBackupZip } from './archive';
import { createExportZip, type ExportTableName } from './export';
import {
    backupFilePrefix,
    checkedManualBackupPath,
    fitsNameLimit,
    resolveBackupFile,
    safetyFileName
} from './files';
import { csvExportRows, wipeCellar } from './repository';
import {
    copyBackupImages,
    InvalidBackupError,
    isBackupImageEntry,
    removeUnreferencedImages,
    validateBackupDatabase
} from './restore';
import {
    BACKUP_SETTING_KEYS,
    getBackupSettings,
    putBackBackupSettings,
    reschedule,
    runAutomaticBackup,
    storedBackupSettings,
    type BackupMode
} from './scheduler';
import { getBackupTokenHash, putBackBackupToken } from './token';

/** The settings of automatic backups, as the admin page reads them. */
export function getBackupSettingsView() {
    const { enabled, intervalHours, keepCount, lastBackup, mode } = getBackupSettings();
    return {
        autoBackupEnabled: enabled,
        autoBackupInterval: intervalHours,
        autoBackupKeepCount: keepCount,
        lastAutoBackup: lastBackup,
        autoBackupMode: mode,
        // Only whether there is one: the token itself is shown once, when it is created.
        hasBackupToken: getBackupTokenHash() !== undefined
    };
}

export interface BackupSettingsInput {
    autoBackupEnabled: boolean;
    autoBackupInterval: number;
    autoBackupKeepCount: number;
    /** Left out, the stored mode stays. */
    autoBackupMode?: BackupMode;
}

/** Saves the settings, all or none, and plans the next backup with them at once. */
export function saveBackupSettings(input: BackupSettingsInput): void {
    setAppSettings({
        [BACKUP_SETTING_KEYS.enabled]: String(input.autoBackupEnabled),
        [BACKUP_SETTING_KEYS.intervalHours]: String(input.autoBackupInterval),
        [BACKUP_SETTING_KEYS.keepCount]: String(input.autoBackupKeepCount),
        ...(input.autoBackupMode && { [BACKUP_SETTING_KEYS.mode]: input.autoBackupMode })
    });
    // No restart needed for a new interval, mode or state to apply.
    reschedule();
}

/** The backup that the cron job asks for. */
export async function runCronBackup() {
    const settings = getBackupSettings();
    if (!settings.enabled || settings.mode !== 'cron') {
        throw new ConflictError(
            'cron_backups_disabled',
            'Automatic backups are not enabled in the external cron job mode'
        );
    }
    const timestamp = new Date().toISOString();
    return { files: await runAutomaticBackup('cron'), timestamp };
}

/** The name, which download-backup takes, and the size of a file just written in DATA_DIR. */
async function writtenFile(filePath: string) {
    return { filename: path.basename(filePath), size: (await stat(filePath)).size };
}

/**
 * Writes a backup, named after `name` when there is one; also returns whether a restore from the
 * admin page would take it.
 */
export async function createManualBackup(name: string | undefined) {
    const backupPath = checkedManualBackupPath('backup', name, backupTimestamp());
    const restorable = await createBackupZip(backupPath);
    console.log('Manual backup created:', path.basename(backupPath));
    return { ...(await writtenFile(backupPath)), restorable };
}

/**
 * Writes an export, named after `name` when there is one; also returns its number of rows, and
 * whether an import from the admin page would take it.
 */
export async function createManualExport(name: string | undefined) {
    const zipPath = checkedManualBackupPath('export', name, backupTimestamp());
    const { recordCount, restorable } = await createExportZip(zipPath, 'manual-export');
    console.log('Manual full export (ZIP with JSON + images) created:', path.basename(zipPath));
    return { file: await writtenFile(zipPath), recordCount, restorable };
}

/** The backup or export `filename`; throws when the name is not one or the file is missing. */
function existingBackupFile(filename: string, invalidMessage: string): string {
    const filePath = resolveBackupFile(filename);
    if (!filePath) throw invalidField('filename', invalidMessage);
    if (!existsSync(filePath)) throw new NotFoundError('Backup file not found');
    return filePath;
}

export async function deleteBackup(filename: string): Promise<void> {
    await unlink(existingBackupFile(filename, 'Invalid file type. Can only delete backup files.'));
    console.log('Deleted backup file:', filename);
}

/**
 * The zip of a restore or an import. A backup of the list is read where it is. An upload is written
 * to `tempFile` as it arrives, so that memory does not grow with its size; the caller removes it.
 */
export async function zipPathOf(source: ZipSource, tempFile: string): Promise<string> {
    if ('filename' in source)
        return existingBackupFile(source.filename, 'Invalid backup file name');
    await pipeline(
        Readable.fromWeb(source.upload as NodeReadableStream<Uint8Array>),
        createWriteStream(tempFile)
    );
    return tempFile;
}

/**
 * The backup or export named `filename`, to download. The file is streamed: a backup can be far
 * larger than the memory of a NAS.
 */
export async function openBackupFile(filename: string) {
    const filePath = existingBackupFile(filename, 'Invalid file path');
    const { size } = await stat(filePath);
    return {
        filename: path.basename(filePath),
        // resolveBackupFile only takes zips
        contentType: 'application/zip',
        size,
        body: Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>
    };
}

// The ids and timestamps are left out: the names of the rows referred to stand for the ids.
const LEFT_OUT_COLUMNS = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'countryId',
    'regionId',
    'containerId',
    'appellationId',
    'classificationId',
    'typeId',
    'colorId',
    'definitionId',
    'originId',
    'formatId',
    'storageCaseId',
    'imageId'
]);

function toCsv(rows: Record<string, unknown>[], delimiter: string): string {
    const kept = rows.map((row) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => !LEFT_OUT_COLUMNS.has(key)))
    );
    const keys = [...new Set(kept.flatMap((row) => Object.keys(row)))];
    const lines = kept.map((row) =>
        csvLine(
            keys.map((key) => row[key]),
            delimiter
        )
    );
    return [csvLine(keys, delimiter), ...lines].join('\n');
}

export interface CsvExportRequest {
    tables: ExportTableName[];
    customName?: string;
    delimiter: string;
}

/**
 * One CSV file per table that has rows, for the browser to save: they are not written on the
 * server. The CSV import recognises the table of a file by its name.
 */
export function exportCsvTables({ tables, customName, delimiter }: CsvExportRequest) {
    const name = customName?.trim();
    // As an export's: the CSV import reads the table in the rest of the name.
    const filePrefix = backupFilePrefix('export') + (name ? `${name}-` : '');
    // The browser saves the files under this name, which must be a plain file name like that of
    // a backup. The table names and the timestamp appended later keep it plain.
    if (!resolveInDir(DATA_DIR, filePrefix) || !fitsNameLimit(name ?? '')) {
        throw new ValidationError('invalid_file_name', 'Invalid export name');
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16); // YYYY-MM-DDTHH-MM
    const files = tables.flatMap((table) => {
        const rows = csvExportRows(table);
        if (rows.length === 0) return [];
        return [
            {
                filename: `${filePrefix}${table}-${timestamp}.csv`,
                csv: toCsv(rows, delimiter),
                recordCount: rows.length
            }
        ];
    });

    if (files.length === 0) {
        throw new ConflictError('nothing_to_export', 'No data to export from selected tables');
    }
    return {
        files,
        totalRecords: files.reduce((sum, file) => sum + file.recordCount, 0),
        exportedAt: now.toISOString()
    };
}

/**
 * The ValidationError for a file that is not a backup this version can read. `problem` lets the
 * UI say why in its language; `reason` says it in English, for scripts and logs.
 */
const invalidBackup = (error: InvalidBackupError) =>
    new ValidationError('invalid_backup', `Invalid backup: ${error.message}`, {
        problem: error.problem,
        ...error.values,
        reason: error.message
    });

/** Thrown when the pre-restore backup fails: nothing is restored then. */
class PreRestoreBackupError extends Error {}

/**
 * Replaces the database and the images with those of the backup `source`, after saving the current
 * ones in a pre-restore backup. The access code, the automatic backup settings and the cron token,
 * the upgrade state and the barcode counters belong to the instance and stay, the upgrade actions of
 * the backup's version added; `session`, the admin's, is the only one left.
 */
export async function restoreBackup(source: ZipSource, session: Session) {
    const timestamp = backupTimestamp();
    const tempFile = path.join(DATA_DIR, `temp-restore-${timestamp}.zip`);
    const extractDir = path.join(DATA_DIR, `temp-extract-${timestamp}`);
    const preRestoreBackup = path.join(DATA_DIR, safetyFileName('backup', 'restore', timestamp));

    try {
        const zipPath = await zipPathOf(source, tempFile);
        // Logged once the name is known to be that of a backup.
        const label = 'filename' in source ? path.basename(zipPath) : 'an uploaded zip';
        console.log(`🔧 Restoring ${label}`);
        await mkdir(extractDir, { recursive: true });
        const extracted = await extractZip(
            zipPath,
            extractDir,
            (name) => name === 'cellar.db' || isBackupImageEntry(name)
        );

        // Every check before anything is written, the pre-restore backup included.
        if (!extracted.includes('cellar.db')) {
            throw new InvalidBackupError(
                'no_database',
                'It holds no cellar.db: it is not a Cellar backup.'
            );
        }
        const extractedDb = path.join(extractDir, 'cellar.db');
        validateBackupDatabase(extractedDb);
        const backupActions = checkRestoredDatabase(extractedDb);

        const images = await holdWrites(async () => {
            try {
                // Blocking: without a copy of the current database, a restore could lose it.
                await createBackupZip(preRestoreBackup);
            } catch (error) {
                throw new PreRestoreBackupError('The pre-restore backup failed', { cause: error });
            }

            const accessCodeHash = await getStoredAccessCode(db);
            const backupSettings = storedBackupSettings();
            const backupTokenHash = getBackupTokenHash();
            const upgradeActions = getUpgradeActionsSetting();
            const lastBarcodeNumbers = getLastBarcodeNumbers();
            await replaceDatabaseFile(extractedDb, async (staged) => {
                keepOnlySession(session, staged);
                await putBackAccessCode(staged, accessCodeHash);
                putBackBackupSettings(staged, backupSettings);
                putBackBackupToken(staged, backupTokenHash);
                putBackUpgradeState(staged, upgradeActions, backupActions);
                putBackLastBarcodeNumbers(staged, lastBarcodeNumbers);
            });
            console.log('Database restored from', label);
            const copied = await copyImages(extractDir, extracted, 'backup');
            await removeUnreferencedImages();
            return copied;
        });
        return {
            success: true,
            message: `Database and images restored successfully from ZIP file. ${images.restored ? 'Images were restored.' : 'No images found in backup.'}${images.copyFailed ? ' Its images could not be copied.' : ''}`,
            restored: { database: true, images: images.restored },
            imagesCopyFailed: images.copyFailed,
            backup: path.basename(preRestoreBackup)
        };
    } catch (error) {
        if (error instanceof InvalidZipError) {
            throw invalidBackup(new InvalidBackupError('unreadable_zip', error.message));
        }
        if (error instanceof InvalidBackupError) throw invalidBackup(error);
        // The refusal names the versions, for the UI to say what to do in its language.
        if (error instanceof UpgradeRefusal) {
            throw new ConflictError('backup_refused', error.restoreAdvice, error.refusal);
        }
        if (error instanceof PreRestoreBackupError) {
            console.error('❌ Restore failed:', error);
            throw new OperationFailedError(
                'pre_restore_backup_failed',
                'The current database could not be backed up, so nothing was restored.'
            );
        }
        throw error;
    } finally {
        await rm(extractDir, { recursive: true, force: true });
        await rm(tempFile, { force: true });
    }
}

/**
 * Copies the images of a backup or an import once its data is in: a failure is then only
 * reported, the backup taken first still holding the old images. Called while the writes are
 * held, so that no write meets a database whose images are not there yet.
 */
export async function copyImages(extractDir: string, entries: string[], source: string) {
    try {
        return { restored: (await copyBackupImages(extractDir, entries)) > 0, copyFailed: false };
    } catch (error) {
        // The details, with server paths, stay in the log.
        console.error(`Copying the images of the ${source} failed:`, error);
        return { restored: false, copyFailed: true };
    }
}

/**
 * Empties the cellar and loads the default data again, after a backup, which it returns. Settings,
 * label presets and sessions stay. Writes are held from the backup to the end, as a restore does:
 * a write in between would be missing from the backup.
 */
export function wipeDatabase() {
    return holdWrites(async () => {
        const backupPath = path.join(
            DATA_DIR,
            safetyFileName('backup', 'reset', backupTimestamp())
        );
        await createBackupZip(backupPath);
        console.log('Pre-wipe backup created:', path.basename(backupPath));

        console.log('Starting database wipe (preserving app_settings)...');
        try {
            wipeCellar();
        } catch (error) {
            // The transaction rolled back; the user can fix or delete the files that it names.
            if (error instanceof SeedingError) {
                console.error('Error wiping database:', error);
                throw new OperationFailedError(
                    'wipe_failed',
                    `Nothing was changed. ${error.message}`,
                    {
                        files: error.files.join(', '),
                        fixable: error.userFolder !== undefined,
                        folder: error.userFolder ?? '',
                        reason: error.message
                    }
                );
            }
            throw error;
        }
        await removeUnreferencedImages();
        console.log('✅ Database wipe completed - app_settings preserved, CSV data reimported');
        // By its name, as a restore and a JSON import give the backup they make first.
        return { backup: path.basename(backupPath) };
    });
}
