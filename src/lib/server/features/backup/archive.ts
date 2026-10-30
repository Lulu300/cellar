import { createWriteStream, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { ZipArchive, type Archiver } from 'archiver';
import { db } from '#lib/server/db/index.js';
import { IMAGES_DIR, isImageFileName } from '#lib/server/paths.js';
import { EXTRACTION_LIMITS, withinExtractionLimits } from '#lib/server/zip.js';

/** A file still being written: it never looks like a finished backup, and the next start removes it. */
const PARTIAL_SUFFIX = '.partial';

/**
 * `date` for a file name, to the millisecond (2026-10-12T10-49-05-000): a second backup in the
 * same minute, such as before the right file after the wrong one, must not overwrite the first.
 */
export function backupTimestamp(date = new Date()): string {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, 23);
}

/**
 * Writes a copy of the app's database to `target`, which must not exist. SQLite reads it in one
 * transaction, so the copy holds every committed write and nothing half-written, whatever other
 * requests or programs write meanwhile; copying the file itself could catch it mid-checkpoint.
 * The copy also leaves out free pages, where deleted values could linger.
 */
function snapshotDb(target: string): void {
    db.$client.prepare('VACUUM INTO ?').run(target);
}

/**
 * Writes a backup to `zipPath`: a snapshot of the database as cellar.db, and the images in images/.
 * Returns whether a restore from the admin page would take it.
 */
export async function createBackupZip(zipPath: string): Promise<boolean> {
    const snapshot = `${zipPath}.db${PARTIAL_SUFFIX}`;
    try {
        snapshotDb(snapshot);
        return await writeZipWithImages(zipPath, (archive) => {
            archive.file(snapshot, { name: 'cellar.db' });
        });
    } finally {
        rmSync(snapshot, { force: true });
    }
}

/**
 * Writes the zip `zipPath` with the entries that `addEntries` adds, then the images in images/.
 * Rejects, removing the temporary file, when the zip cannot be written. Returns whether a restore
 * or an import from the admin page would take it: a zip past their limits is kept, as it holds
 * the data and can be restored by hand, and the log says so.
 */
export async function writeZipWithImages(
    zipPath: string,
    addEntries: (archive: Archiver) => void
): Promise<boolean> {
    await writeZip(zipPath, addEntries);
    const restorable = await withinExtractionLimits(zipPath);
    if (!restorable) {
        console.warn(
            `⚠️ ${path.basename(zipPath)} is larger than a restore or an import from the admin page accepts (${EXTRACTION_LIMITS}): it can only be restored by hand, as README-Docker.md describes.`
        );
    }
    return restorable;
}

/**
 * The zip is written under a temporary name and renamed once complete, so that an interrupted
 * backup (a full disk, `docker stop`) never leaves a truncated zip under a backup's name.
 */
function writeZip(zipPath: string, addEntries: (archive: Archiver) => void): Promise<void> {
    const partialPath = zipPath + PARTIAL_SUFFIX;
    // Listed before the file is created, so that a failure here leaves nothing behind.
    const images = imageFilesInFolder();
    return new Promise((resolve, reject) => {
        const output = createWriteStream(partialPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });
        let failure: Error | undefined;

        // Decided on 'close', which also follows a failure: a file whose opening was still pending
        // when the archive failed is created anyway, then closed.
        output.on('close', () => {
            try {
                if (failure) throw failure;
                renameSync(partialPath, zipPath);
                console.log(`Archive created: ${zipPath}, ${archive.pointer()} bytes`);
                resolve();
            } catch (error) {
                rmSync(partialPath, { force: true });
                reject(error);
            }
        });

        // From the archive (an unreadable image) or from the file (a full disk, a missing folder):
        // without a listener, a stream error would crash the process.
        function fail(error: Error) {
            if (failure) return;
            failure = error;
            archive.abort();
            output.destroy();
        }
        archive.on('error', fail);
        output.on('error', fail);

        archive.pipe(output);

        addEntries(archive);
        for (const name of images) {
            archive.file(path.join(IMAGES_DIR, name), { name: `images/${name}` });
        }

        // The 'error' listener above handles the failure; an unhandled rejection would stop the process.
        archive.finalize().catch(fail);
    });
}

/**
 * The images a backup holds: the regular files of IMAGES_DIR that the app can serve. Hidden files
 * (.DS_Store, a NAS's .@__thumb) and folders are left out, as a restore would refuse them.
 */
export function imageFilesInFolder(): string[] {
    try {
        return readdirSync(IMAGES_DIR, { withFileTypes: true })
            .filter((entry) => entry.isFile() && isImageFileName(entry.name))
            .map((entry) => entry.name);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}
