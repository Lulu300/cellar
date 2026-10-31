import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ValidationError } from '#lib/server/http/errors.js';
import { DATA_DIR, resolveInDir } from '#lib/server/paths.js';

export type BackupKind = 'backup' | 'export';
export type AutomaticSource = 'internal' | 'cron';
/** What a safety backup was made before: a restore, a wipe or a JSON import. */
export type SafetyReason = 'restore' | 'reset' | 'import';

export interface BackupFile {
    filename: string;
    size: number;
    created: Date;
    /** manual-backup, automatic-backup-internal, automatic-export-cron, safety-backup-restore... */
    type: string;
    isDatabase: boolean;
    isAutomatic: boolean;
    isExport: boolean;
    isZip: true;
}

/** The start of the name of every backup and export, which download-backup serves. */
export const backupFilePrefix = (kind: BackupKind) => `cellar-${kind}-`;

// A backup or an export. Not a zip still being written, which ends with `.partial`.
const BACKUP_FILE = /^cellar-(backup|export)-.*\.zip$/;
// The names that the scheduler and the cron route give.
const AUTOMATIC_FILE = /^cellar-(?:backup|export)-auto-(internal|cron)-/;
// The names of safetyFileName.
const SAFETY_FILE = /^cellar-(?:backup|export)-pre-(restore|reset|import)-/;
// Custom names never start with it, so that retention, which goes by name, deletes only
// automatic files.
const AUTOMATIC_PREFIX = 'auto-';
/** Whether a custom name is kept for automatic files: `auto`, or a name that starts with `auto-`. */
const isReservedName = (customName: string) => `${customName}-`.startsWith(AUTOMATIC_PREFIX);
// A file name holds 255 bytes at most. A backup adds about 60 to the custom name: the prefix, the
// timestamp, `.zip.db.partial` for its snapshot, and `-journal` that SQLite may add to that.
const MAX_NAME_BYTES = 150;

/** Whether a custom name, counted in bytes as the file system does, fits in the files named after it. */
export const fitsNameLimit = (customName: string) =>
    Buffer.byteLength(customName) <= MAX_NAME_BYTES;

/** The file name of a new automatic backup or export. */
export function automaticFileName(kind: BackupKind, source: AutomaticSource, timestamp: string) {
    return `${backupFilePrefix(kind)}${AUTOMATIC_PREFIX}${source}-${timestamp}.zip`;
}

/** The file name of the backup that a restore, a wipe or a JSON import makes first. */
export function safetyFileName(kind: BackupKind, reason: SafetyReason, timestamp: string) {
    return `${backupFilePrefix(kind)}pre-${reason}-${timestamp}.zip`;
}

/**
 * The path of a new manual backup or export, named after `customName` when there is one. Null
 * when the name cannot be used: one that leaves DATA_DIR, that starts like an automatic file, or
 * that is too long.
 */
export function manualBackupPath(
    kind: BackupKind,
    customName: string | undefined,
    timestamp: string
): string | null {
    if (!customName) return resolveInDir(DATA_DIR, `${backupFilePrefix(kind)}${timestamp}.zip`);
    if (isReservedName(customName) || !fitsNameLimit(customName)) return null;
    return resolveInDir(DATA_DIR, `${backupFilePrefix(kind)}${customName}-${timestamp}.zip`);
}

/** The body of a request for a manual backup or export: a name, optional, or none at all. */
export const manualBackupRequest = z.object({ name: z.string().trim().optional() }).optional();

/** The body of a request that names a backup or export of the list. */
export const backupFileRequest = z.object({ filename: z.string() });

/**
 * The path of a new manual backup or export named after `customName` when there is one. Throws
 * a ValidationError for a name that cannot be used.
 */
export function checkedManualBackupPath(
    kind: BackupKind,
    customName: string | undefined,
    timestamp: string
): string {
    if (customName && isReservedName(customName)) {
        throw new ValidationError(
            'invalid_file_name',
            `Invalid ${kind} name: "auto" and the names that start with "auto-" are kept for automatic backups and exports`,
            { kind: 'reserved' }
        );
    }
    const backupPath = manualBackupPath(kind, customName || undefined, timestamp);
    if (!backupPath) {
        throw new ValidationError(
            'invalid_file_name',
            `Invalid ${kind} name: it cannot hold a "/" or be longer than ${MAX_NAME_BYTES} bytes`
        );
    }
    return backupPath;
}

/** Resolves a backup or export file in DATA_DIR, or returns null for any other name. */
export function resolveBackupFile(name: unknown): string | null {
    return typeof name === 'string' && BACKUP_FILE.test(name) ? resolveInDir(DATA_DIR, name) : null;
}

/** The backups and exports in DATA_DIR, newest first. */
export async function listBackups(): Promise<BackupFile[]> {
    const files: BackupFile[] = [];
    for (const filename of await readdir(DATA_DIR)) {
        const kind = BACKUP_FILE.exec(filename)?.[1] as BackupKind | undefined;
        if (!kind) continue;

        let stats;
        try {
            stats = await stat(path.join(DATA_DIR, filename));
        } catch (error) {
            // Deleted since the listing, for example by the retention of an automatic backup.
            console.warn(`Could not get stats for ${filename}:`, error);
            continue;
        }
        const source = AUTOMATIC_FILE.exec(filename)?.[1];
        const safetyReason = SAFETY_FILE.exec(filename)?.[1];
        files.push({
            filename,
            size: stats.size,
            created: stats.mtime,
            type: source
                ? `automatic-${kind}-${source}`
                : safetyReason
                  ? `safety-${kind}-${safetyReason}`
                  : `manual-${kind}`,
            isDatabase: kind === 'backup',
            isAutomatic: source !== undefined,
            isExport: kind === 'export',
            isZip: true
        });
    }
    return files.sort((a, b) => b.created.getTime() - a.created.getTime());
}

/**
 * Deletes the oldest automatic files of `kind` beyond the `keep` newest. Backups and exports are
 * counted apart, so that `keep` backups are kept whatever the number of exports.
 */
export async function applyRetention(kind: BackupKind, keep: number): Promise<void> {
    const automatic = (await listBackups()).filter(
        ({ filename }) =>
            filename.startsWith(backupFilePrefix(kind)) && AUTOMATIC_FILE.test(filename)
    );
    for (const { filename } of automatic.slice(keep)) {
        try {
            await unlink(path.join(DATA_DIR, filename));
            console.log('🗑️  Deleted old automatic file:', filename);
        } catch (error) {
            console.warn('Could not delete old automatic file:', filename, error);
        }
    }
}
