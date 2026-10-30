import { closeSync, openSync, readSync } from 'node:fs';
import { copyFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { openDatabase } from '#lib/server/db/connection.js';
import { imageFilenames } from '#lib/server/features/images/repository.js';
import { IMAGES_DIR, isImageFileName, resolveInDir } from '#lib/server/paths.js';
import { detectImageType } from '#lib/server/upload.js';
import { imageFilesInFolder } from './archive';

/** What is wrong with a file that is not a Cellar backup, for the UI to say it in its language. */
export type BackupProblem =
    | 'unreadable_zip'
    | 'no_database'
    | 'not_sqlite'
    | 'damaged'
    | 'not_cellar'
    | 'no_migrations'
    | 'unknown_version';

/**
 * The uploaded file is not a Cellar backup that can be restored. The message says why, and
 * `values` holds what the UI needs to say it, such as the version a backup records.
 */
export class InvalidBackupError extends Error {
    readonly values: Record<string, string>;

    constructor(
        readonly problem: BackupProblem,
        message: string,
        options?: ErrorOptions & { values?: Record<string, string> }
    ) {
        super(message, options);
        this.values = options?.values ?? {};
    }
}

const SQLITE_HEADER = 'SQLite format 3\0';

// Created by the first migration, so present in a backup of any version since 0.1.0, and read by
// the app: every table of 0000_clear_hellcat but label_presets. Any other SQLite file, an empty one
// included, is refused rather than migrated into an empty cellar. Written out rather than derived
// from the schema, which later versions extend.
const REQUIRED_TABLES = [
    'app_settings',
    'countries',
    'regions',
    'appellations',
    'wine_classifications',
    'wine_types',
    'wine_colors',
    'wine_formats',
    'origins',
    'storage_containers',
    'storage_cases',
    'wine_images',
    'wine_definitions',
    'wine_bottles'
];

/**
 * Throws InvalidBackupError unless `file` is a sound Cellar database: a SQLite file that passes
 * SQLite's integrity check and holds the tables of a cellar. Runs before anything is changed.
 */
export function validateBackupDatabase(file: string): void {
    if (readHead(file, SQLITE_HEADER.length).toString('latin1') !== SQLITE_HEADER) {
        throw new InvalidBackupError('not_sqlite', 'Its cellar.db is not a SQLite database.');
    }
    try {
        const { $client: candidate } = openDatabase(file);
        try {
            const result = candidate.pragma('integrity_check', { simple: true });
            if (result !== 'ok') {
                throw new InvalidBackupError('damaged', `Its database is damaged: ${result}`);
            }
            const tables = new Set(
                candidate
                    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
                    .pluck()
                    .all()
            );
            const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
            if (missing.length > 0) {
                throw new InvalidBackupError(
                    'not_cellar',
                    `Its database is not a Cellar database: it lacks ${missing.join(', ')}.`
                );
            }
        } finally {
            candidate.close();
        }
    } catch (error) {
        // SQLITE_CORRUPT, SQLITE_NOTADB...: the file, not the server, is at fault.
        if (String((error as { code?: unknown }).code).startsWith('SQLITE_')) {
            throw new InvalidBackupError(
                'damaged',
                `Its database cannot be read: ${(error as Error).message}`,
                { cause: error }
            );
        }
        throw error;
    }
}

function readHead(file: string, length: number): Buffer {
    const head = Buffer.alloc(length);
    const fd = openSync(file, 'r');
    try {
        return head.subarray(0, readSync(fd, head, 0, length, 0));
    } finally {
        closeSync(fd);
    }
}

const IMAGES_PREFIX = 'images/';
// What detectImageType reads at most.
const IMAGE_HEAD_BYTES = 12;

/**
 * Whether a zip entry is an image to extract from a backup or an export: a file directly in
 * images/ whose name the app can serve. Subfolders and hidden files, such as .DS_Store, are not.
 */
export function isBackupImageEntry(entryName: string): boolean {
    return (
        entryName.startsWith(IMAGES_PREFIX) &&
        isImageFileName(entryName.slice(IMAGES_PREFIX.length))
    );
}

/**
 * Copies to IMAGES_DIR the images extracted to `extractDir`, given the zip entries that were
 * extracted. Like an upload, an image is recognised by its content: other files are skipped.
 * Returns how many images were copied.
 */
export async function copyBackupImages(extractDir: string, entries: string[]): Promise<number> {
    let copied = 0;
    for (const entry of entries.filter(isBackupImageEntry)) {
        const source = path.join(extractDir, entry);
        const target = resolveInDir(IMAGES_DIR, entry.slice(IMAGES_PREFIX.length));
        if (!target || !detectImageType(readHead(source, IMAGE_HEAD_BYTES))) {
            console.warn(`Not restored, as it is not a JPEG, PNG, WebP or GIF image: ${entry}`);
            continue;
        }
        await mkdir(IMAGES_DIR, { recursive: true });
        await copyFile(source, target);
        copied += 1;
    }
    return copied;
}

/**
 * Deletes the images of IMAGES_DIR that no row of wine_images cites, once a wipe or a restore has
 * replaced the rows: they would stay on the disk, served but missing from the admin's images, and
 * grow every backup. The backup made first holds them. A failure is only logged, the data being in.
 */
export async function removeUnreferencedImages(): Promise<void> {
    try {
        const cited = imageFilenames();
        for (const name of imageFilesInFolder()) {
            if (!cited.has(name)) await unlink(path.join(IMAGES_DIR, name));
        }
    } catch (error) {
        console.error('Deleting the images that no wine uses any more failed:', error);
    }
}
