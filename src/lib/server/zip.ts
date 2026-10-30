import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import yauzl, { type Entry, type ZipFile } from 'yauzl';

/**
 * Largest zip upload accepted by the restore and import routes. A backup that the server already
 * has is restored or imported by its name, without this limit but within those of the extraction.
 */
export const MAX_ZIP_UPLOAD_BYTES = 500 * 1024 * 1024;

// A backup holds one database and one file per wine image: a few thousand entries for a large cellar.
const MAX_ZIP_ENTRIES = 10_000;
// A backup is mostly images, which are already compressed, plus a database of a few MB, so it
// inflates to little more than its own size: this lets backups of up to about 2 GB through, and
// stops a zip bomb before it fills the disk.
const MAX_ZIP_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;

/** The archive cannot be used: corrupt, unsafe entry name, or over a limit. Routes answer 400. */
export class InvalidZipError extends Error {}

/**
 * Extracts the entries accepted by `shouldExtract` into `destDir`, keeping their relative paths,
 * and returns their names. Directory entries are skipped.
 *
 * yauzl rejects absolute paths and `..` segments in entry names, so joining them to `destDir` is
 * safe. Limits use the sizes declared in the central directory: yauzl checks that each entry
 * inflates to exactly its declared size, so a lying header fails as a corrupt archive.
 */
export function extractZip(
    zipPath: string,
    destDir: string,
    shouldExtract: (entryName: string) => boolean
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (openError, zipfile) => {
            if (openError) return reject(new InvalidZipError(openError.message));

            const extracted: string[] = [];
            let uncompressedBytes = 0;

            const fail = (error: Error) => {
                zipfile.close();
                reject(error);
            };

            const extractEntry = async (entry: Entry) => {
                uncompressedBytes += entry.uncompressedSize;
                if (uncompressedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
                    throw new InvalidZipError('ZIP content is too large once uncompressed');
                }
                if (entry.fileName.endsWith('/') || !shouldExtract(entry.fileName)) return;

                const target = path.join(destDir, entry.fileName);
                await mkdir(path.dirname(target), { recursive: true });
                await writeEntry(await openReadStream(zipfile, entry), target);
                extracted.push(entry.fileName);
            };

            zipfile.on('error', (error: Error) => fail(new InvalidZipError(error.message)));
            zipfile.on('end', () => resolve(extracted));
            zipfile.on('entry', (entry: Entry) => {
                extractEntry(entry).then(() => zipfile.readEntry(), fail);
            });

            if (zipfile.entryCount > MAX_ZIP_ENTRIES) {
                return fail(new InvalidZipError(`ZIP has more than ${MAX_ZIP_ENTRIES} entries`));
            }
            zipfile.readEntry();
        });
    });
}

/** The limits of extractZip, as a log says them. */
export const EXTRACTION_LIMITS = `${MAX_ZIP_UNCOMPRESSED_BYTES / 1024 ** 3} GiB uncompressed, ${MAX_ZIP_ENTRIES} files`;

/**
 * Whether extractZip would take the zip `zipPath`: within its limits, which a restore or an import
 * applies to a backup of the list too. Extracts nothing.
 */
export async function withinExtractionLimits(zipPath: string): Promise<boolean> {
    try {
        await extractZip(zipPath, path.dirname(zipPath), () => false);
        return true;
    } catch (error) {
        if (error instanceof InvalidZipError) return false;
        throw error;
    }
}

function openReadStream(zipfile: ZipFile, entry: Entry): Promise<Readable> {
    return new Promise((resolve, reject) => {
        zipfile.openReadStream(entry, (error, stream) => {
            if (error) reject(new InvalidZipError(error.message));
            else resolve(stream);
        });
    });
}

// The two streams report errors separately: a read error means a corrupt archive (400),
// a write error a server problem such as a full disk (500).
// yauzl emits inflate errors on the read stream without destroying it, and the stream holds a
// reference to the zip file descriptor: it must be destroyed or the descriptor leaks.
function writeEntry(readStream: Readable, target: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(target);
        readStream.on('error', (error) => {
            readStream.destroy();
            writeStream.destroy();
            reject(new InvalidZipError(error.message));
        });
        writeStream.on('error', (error) => {
            readStream.destroy();
            reject(error);
        });
        writeStream.on('close', resolve);
        readStream.pipe(writeStream);
    });
}
