import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, renameSync, type Stats } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import type { WineImage } from '#lib/server/db/schema.js';
import {
    ConflictError,
    invalidField,
    NotFoundError,
    OperationFailedError,
    tooLargeError,
    ValidationError
} from '#lib/server/http/errors.js';
import { DATA_DIR, IMAGES_DIR, imageUrl, resolveInDir } from '#lib/server/paths.js';
import {
    detectImageFileType,
    detectImageType,
    imageContentType,
    newImageFileName
} from '#lib/server/upload.js';
import { extractZip, InvalidZipError, MAX_ZIP_UPLOAD_BYTES } from '#lib/server/zip.js';
import { MAX_WINE_IMAGE_BYTES } from '#lib/shared/images.js';
import {
    addOtherPhoto,
    deleteImageRows,
    getImage,
    getImages,
    findImageByFilename,
    imageFilenames,
    insertImage,
    listImages,
    mainPhotoId,
    otherPhotos,
    removeOtherPhoto,
    renameImageRow,
    setMainPhoto,
    tidyWinePhotos,
    winesUsingImages,
    wishesUsingImages
} from './repository';

/** The URL of each image, for the wine pages. */
export function listImageUrls() {
    return listImages().map((image) => ({ id: image.id, url: imageUrl(image) }));
}

/** The URL of each image by its id, for the load functions of the pages that show wines. */
export function imageUrlsById(): Map<string, string> {
    return new Map(listImageUrls().map(({ id, url }) => [id, url]));
}

/** The image with the size and date of its file. */
async function withFileStats(image: WineImage) {
    const filePath = resolveInDir(IMAGES_DIR, image.filename);
    // A missing file, or a stored name that cannot designate one, is listed without file stats
    const stats = filePath ? await stat(filePath).catch(() => null) : null;
    return {
        id: image.id,
        filename: image.filename,
        path: image.path,
        size: stats?.size ?? 0,
        lastModified: stats?.mtime ?? image.updatedAt,
        url: imageUrl(image),
        createdAt: image.createdAt,
        updatedAt: image.updatedAt
    };
}

/**
 * The file named `name` in the image folder, as /uploads serves it, or null when there is no such
 * file or the name cannot designate one. Its type comes from its extension, which a rename checks:
 * a file of another format, such as one of a zip import, is served as mere bytes.
 */
export async function readImageFile(name: string | null) {
    const filePath = resolveInDir(IMAGES_DIR, name);
    const stats = filePath ? await stat(filePath).catch(() => null) : null;
    if (!filePath || !stats?.isFile()) return null;
    return {
        // A buffer, not a file stream: undici wraps a Node stream body in a web stream that throws
        // an uncaught error, killing the server, when the client hangs up just before the end of the
        // file. Wine photos weigh a few MB at most, so reading one whole is cheap.
        bytes: new Uint8Array(await readFile(filePath)),
        contentType: imageContentType(filePath) ?? 'application/octet-stream',
        lastModified: stats.mtime
    };
}

/** The wines and the wishes that use each of these images: what `users(imageId)` gives. */
function usersOf(imageIds: string[], tx: Tx = db) {
    const wines = Map.groupBy(winesUsingImages(imageIds, tx), (wine) => wine.imageId);
    const wishes = Map.groupBy(wishesUsingImages(imageIds, tx), (wish) => wish.imageId);
    return (imageId: string) => ({
        wines: (wines.get(imageId) ?? []).map(({ id, name, producer }) => ({ id, name, producer })),
        // A wish with a photo always has a text (wishes_wine_or_text_check).
        wishes: (wishes.get(imageId) ?? []).map(({ id, name }) => ({ id, name: name ?? '' }))
    });
}

type ImageUsers = ReturnType<ReturnType<typeof usersOf>>;

const isUsed = ({ wines, wishes }: ImageUsers) => wines.length + wishes.length > 0;

/** The image as GET /api/admin/images lists it, with the wines and the wishes that use it. */
async function listedImage(image: WineImage, users: (imageId: string) => ImageUsers) {
    return { ...(await withFileStats(image)), ...users(image.id) };
}

/**
 * Every image with the size and date of its file, and the wines and wishes that use it, newest
 * first. The stored names are random, so the wines and wishes are what tells most images apart.
 */
export async function listImagesWithStats() {
    const images = listImages();
    const users = usersOf(images.map((image) => image.id));
    const listed = await Promise.all(images.map((image) => listedImage(image, users)));
    return listed.sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
}

// What most file systems allow, in bytes of UTF-8: a longer name failed with a 500.
const MAX_FILE_NAME_BYTES = 255;

/**
 * Renames the image and its file, and returns it as the list of images gives it. The new name must
 * be a plain file name of 255 bytes at most with an image extension, which sets the type /uploads
 * serves it with.
 */
export async function renameImage(imageId: string, newFilename: string) {
    const newPath = resolveInDir(IMAGES_DIR, newFilename);
    if (
        !newPath ||
        Buffer.byteLength(newFilename) > MAX_FILE_NAME_BYTES ||
        !imageContentType(newFilename)
    ) {
        throw new ValidationError(
            'invalid_file_name',
            'An image name must be a plain file name of 255 bytes at most, ending in .jpg, .jpeg, .png, .gif or .webp',
            { kind: 'image' }
        );
    }

    const image = getImage(imageId);
    if (!image) throw new NotFoundError('Image not found');
    const oldPath = resolveInDir(IMAGES_DIR, image.filename);

    const taken = () =>
        new ConflictError('duplicate_name', 'An image with this filename already exists');
    if (findImageByFilename(newFilename)) throw taken();
    if (!oldPath || !existsSync(oldPath)) {
        throw new NotFoundError('Physical image file not found');
    }
    if (existsSync(newPath)) throw taken();

    // The file is renamed last, inside the transaction: if either fails, neither changes.
    const updated = db.transaction((tx) => {
        const row = renameImageRow(imageId, newFilename, tx);
        if (!row) throw new NotFoundError('Image not found');
        renameSync(oldPath, newPath);
        return row;
    });

    return listedImage(updated, usersOf([imageId]));
}

/**
 * Deletes images. Without `force`, images that wines or wishes use are refused with a
 * ConflictError that lists them, so that the user can confirm; with it, they are removed from
 * those wines and wishes first, a wine that loses its main photo taking its next one. Ids that
 * match no image are ignored: another tab may have deleted them already.
 */
export async function deleteImages(imageIds: string[], force: boolean): Promise<void> {
    // One transaction: no wine can take one of these images between the check and the
    // deletion, and no wine keeps pointing to a deleted image or loses its image for nothing.
    const deletedImages = db.transaction((tx) => {
        const images = getImages(imageIds, tx);
        const users = usersOf(imageIds, tx);
        const inUse = images
            .map((image) => ({ id: image.id, filename: image.filename, ...users(image.id) }))
            .filter(isUsed);
        // Decided on images that exist: a reference to a missing image, left by data older than
        // the foreign key, would otherwise refuse the deletion with nothing to show.
        if (inUse.length > 0 && !force) {
            throw new ConflictError('in_use', 'Images are used by wines or wishes', { inUse });
        }

        // The foreign keys remove them from the wines and wishes that use them (ON DELETE SET
        // NULL for a main photo and a wish, CASCADE for the other photos of a wine).
        deleteImageRows(imageIds, tx);
        tidyWinePhotos(tx);
        return images;
    });
    await removeImageFiles(deletedImages);
}

/**
 * Deletes the rows of those of these images that no wine and no wish uses any more, and returns
 * them, for removeImageFiles to remove their files once the transaction is over.
 */
export function dropUnusedImages(imageIds: string[], tx: Tx): WineImage[] {
    const users = usersOf(imageIds, tx);
    const unused = getImages(imageIds, tx).filter((image) => !isUsed(users(image.id)));
    deleteImageRows(
        unused.map((image) => image.id),
        tx
    );
    return unused;
}

/**
 * Removes the files of images whose rows are gone. Files go last, as they cannot be restored:
 * once the rows are gone the images are deleted for the app, so a file that cannot be removed is
 * only logged. A stored name that is not a plain file name cannot designate one of our files.
 */
export async function removeImageFiles(images: WineImage[]): Promise<void> {
    for (const image of images) {
        const filePath = resolveInDir(IMAGES_DIR, image.filename);
        if (filePath) {
            await rm(filePath, { force: true }).catch((error) =>
                console.error(`Error deleting image file ${image.filename}:`, error)
            );
        }
    }
}

/** Saves an uploaded image, recognised by its content, under a new name. */
async function saveImage(bytes: Buffer) {
    const imageType = detectImageType(bytes);
    if (!imageType) return null;
    const filename = newImageFileName(imageType);
    await mkdir(IMAGES_DIR, { recursive: true });
    await writeFile(path.join(IMAGES_DIR, filename), bytes);
    return { image: insertImage(filename), type: imageType };
}

/** Saves the image of the wine form, or of a wine's photos. */
export async function uploadImage(file: File) {
    const saved = await saveImage(Buffer.from(await file.arrayBuffer()));
    if (!saved) {
        throw invalidField(
            'image',
            'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'
        );
    }
    return {
        imageId: saved.image.id,
        url: imageUrl(saved.image),
        filename: saved.image.filename,
        size: file.size,
        type: saved.type.mimeType
    };
}

const wineNotFound = () => new NotFoundError('Wine definition not found');
const photoNotFound = () => new NotFoundError('This image is not a photo of this wine');

/** The id of the main photo of the wine, or a NotFoundError when there is no such wine. */
function mainPhotoOf(definitionId: string, tx: Tx = db): string | null {
    const imageId = mainPhotoId(definitionId, tx);
    if (imageId === undefined) throw wineNotFound();
    return imageId;
}

/**
 * Keeps the photos of a wine whose fields were all replaced, its main photo included: a main photo
 * replaced stays among the others, as « Make it the main photo » keeps it, so that no photo leaves
 * the wine unasked; a main photo removed gives way to the next one.
 */
export function followMainPhotoChange(definitionId: string, formerMainId: string | null, tx: Tx) {
    const mainId = mainPhotoId(definitionId, tx);
    if (formerMainId && mainId && mainId !== formerMainId) {
        addOtherPhoto(definitionId, formerMainId, tx);
    }
    tidyWinePhotos(tx);
}

/** The photos of a wine, its main one first, then the others from the oldest. */
export function listWinePhotos(definitionId: string) {
    const mainId = mainPhotoOf(definitionId);
    const main = mainId ? getImage(mainId) : undefined;
    return [main, ...otherPhotos(definitionId)]
        .filter((image) => image !== undefined)
        .map((image) => ({ imageId: image.id, url: imageUrl(image), main: image === main }));
}

/** Saves a photo of the wine: its main one when it has none yet. */
export async function addWinePhoto(definitionId: string, file: File) {
    // Checked first, so that a photo of an unknown wine leaves no file behind. A wine deleted while
    // its photo uploads leaves the image in Admin › Images, where it can be deleted: too rare to undo.
    mainPhotoOf(definitionId);
    const { imageId } = await uploadImage(file);
    db.transaction((tx) => {
        addOtherPhoto(definitionId, imageId, tx);
        tidyWinePhotos(tx);
    });
    return listWinePhotos(definitionId);
}

/** Makes one of the photos of the wine its main one; the main one before stays among the others. */
export function chooseMainPhoto(definitionId: string, imageId: string) {
    db.transaction((tx) => {
        const mainId = mainPhotoOf(definitionId, tx);
        if (mainId === imageId) return;
        if (!removeOtherPhoto(definitionId, imageId, tx)) throw photoNotFound();
        if (mainId) addOtherPhoto(definitionId, mainId, tx);
        setMainPhoto(definitionId, imageId, tx);
    });
    return listWinePhotos(definitionId);
}

/**
 * Removes a photo from the wine, and deletes the image when no other wine and no wish uses it. A
 * main photo removed gives way to the next one.
 */
export async function removeWinePhoto(definitionId: string, imageId: string): Promise<void> {
    const deleted = db.transaction((tx) => {
        if (mainPhotoOf(definitionId, tx) === imageId) setMainPhoto(definitionId, null, tx);
        else if (!removeOtherPhoto(definitionId, imageId, tx)) throw photoNotFound();
        tidyWinePhotos(tx);
        return dropUnusedImages([imageId], tx);
    });
    await removeImageFiles(deleted);
}

/** Saves the images that the admin page uploads, each on its own: one that fails is reported. */
export async function uploadImages(files: File[]) {
    if (files.length === 0) throw invalidField('images', 'No image files provided');

    const successful = [];
    const failed = [];
    for (const file of files) {
        try {
            if (file.size > MAX_WINE_IMAGE_BYTES) {
                failed.push({
                    filename: file.name,
                    error: `Image file too large (max ${MAX_WINE_IMAGE_BYTES / 1024 / 1024} MB)`
                });
                continue;
            }
            const saved = await saveImage(Buffer.from(await file.arrayBuffer()));
            if (!saved) {
                failed.push({
                    filename: file.name,
                    error: 'File must be a JPEG, PNG, WebP or GIF image'
                });
                continue;
            }
            successful.push({
                originalFilename: file.name,
                filename: saved.image.filename,
                imageId: saved.image.id
            });
        } catch (error) {
            console.error(`Error processing image ${file.name}:`, error);
            failed.push({
                filename: file.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    return {
        success: true,
        message: `Processed ${files.length} images`,
        successful,
        failed
    };
}

/** What happened to one file of a zip import. */
interface ZipImportDetail {
    filename: string;
    status: 'success' | 'skipped' | 'error';
    reason: string;
}

/**
 * Copies the images of a zip into IMAGES_DIR, for the image rows that already have their name
 * (an export's rows without their files). Every file of the zip is reported: like an upload, an
 * image is recognised by its content, and a second file of the same name never replaces the first.
 */
export async function importImagesZip(zipFile: File) {
    if (!zipFile.name.toLowerCase().endsWith('.zip')) {
        throw invalidField('zipFile', 'File must be a ZIP archive');
    }
    if (zipFile.size > MAX_ZIP_UPLOAD_BYTES) throw tooLargeError();
    const timestamp = Date.now();
    const tempZipPath = `${DATA_DIR}/temp-zip-import-${timestamp}.zip`;
    const tempExtractDir = `${DATA_DIR}/temp-zip-import-${timestamp}`;
    try {
        await writeFile(tempZipPath, Buffer.from(await zipFile.arrayBuffer()));

        // Extract every file first, so that a corrupt archive fails before any file is replaced.
        // Hidden files (.DS_Store) and the resource forks of a zip made on a Mac (__MACOSX/) are
        // not files the user put in the zip: they are left out of the report.
        const entries = await extractZip(
            tempZipPath,
            tempExtractDir,
            (name) =>
                !name
                    .split('/')
                    // `./`, which some tar tools put before each name, is not hidden
                    .some((part) => (part.startsWith('.') && part !== '.') || part === '__MACOSX')
        );
        if (entries.length === 0) {
            throw invalidField('zipFile', 'No files found in ZIP archive');
        }

        const existingFilenames = imageFilenames();
        const copied = new Set<string>();
        const details: ZipImportDetail[] = [];
        await mkdir(IMAGES_DIR, { recursive: true });

        for (const entryName of entries) {
            const filename = path.basename(entryName);
            const report = (status: ZipImportDetail['status'], reason: string) =>
                details.push({ filename, status, reason });
            try {
                const targetPath = resolveInDir(IMAGES_DIR, filename);
                if (!targetPath) {
                    report('error', 'invalid_filename');
                } else if (!(await detectImageFileType(path.join(tempExtractDir, entryName)))) {
                    report('error', 'not_an_image');
                } else if (!existingFilenames.has(filename)) {
                    report('skipped', 'filename_not_found_in_database');
                } else if (copied.has(filename)) {
                    // The same name in another folder of the zip
                    report('error', 'duplicate_filename');
                } else {
                    await copyFile(path.join(tempExtractDir, entryName), targetPath);
                    copied.add(filename);
                    report('success', 'image_imported_successfully');
                }
            } catch (error) {
                console.error(`Error processing ${filename}:`, error);
                report('error', error instanceof Error ? error.message : 'Unknown error');
            }
        }

        const count = (status: ZipImportDetail['status']) =>
            details.filter((detail) => detail.status === status).length;
        const [successful, skipped, errors] = [count('success'), count('skipped'), count('error')];
        return {
            success: true,
            message: `ZIP import completed. ${successful} successful, ${skipped} skipped, ${errors} errors`,
            successful,
            skipped,
            errors,
            summary: details,
            totalProcessed: entries.length
        };
    } catch (error) {
        if (error instanceof InvalidZipError) {
            throw invalidField('zipFile', `Invalid ZIP file: ${error.message}`);
        }
        throw error;
    } finally {
        await rm(tempZipPath, { force: true });
        await rm(tempExtractDir, { recursive: true, force: true });
    }
}

interface ZipFile {
    path: string;
    name: string;
    stats: Stats;
}

/**
 * Writes the zip of `files` to `zipPath`, in their order. Rejects, once the file is closed, when a
 * file cannot be read or the zip cannot be written.
 */
function writeZip(zipPath: string, files: ZipFile[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });
        let failure: Error | undefined;
        // Decided on 'close', which also follows a failure.
        output.on('close', () => (failure ? reject(failure) : resolve()));

        // Without a listener, an image that cannot be read would stop the server.
        function fail(error: Error) {
            if (failure) return;
            failure = error;
            archive.abort();
            output.destroy();
        }
        archive.on('error', fail);
        output.on('error', fail);

        archive.pipe(output);
        // Given their stats, archiver adds the files in this order, instead of as their stats come.
        for (const file of files) archive.file(file.path, { name: file.name, stats: file.stats });
        archive.finalize().catch(fail);
    });
}

/**
 * A zip of the files of these images, in the order of `imageIds`. Like a backup, it is written to
 * a temporary file, then streamed from it: the images of a cellar can weigh more than the memory
 * of a NAS, and a file that cannot be read fails the request before anything is sent. Missing
 * files are left out.
 */
export async function zipImages(imageIds: string[]) {
    const byId = new Map(getImages(imageIds).map((image) => [image.id, image]));
    const images = imageIds.flatMap((id) => byId.get(id) ?? []);
    if (images.length === 0) throw new NotFoundError('No images found for the provided IDs');

    const files: ZipFile[] = [];
    for (const image of images) {
        // The stored path is ignored: imports used to accept any value, and every image lives in
        // IMAGES_DIR
        const imagePath = resolveInDir(IMAGES_DIR, image.filename);
        if (!imagePath) {
            console.warn(`Invalid image filename: ${image.filename}`);
            continue;
        }
        const stats = await stat(imagePath).catch(() => null);
        if (!stats?.isFile()) {
            console.warn(`Image file not found: ${imagePath}`);
            continue;
        }
        files.push({ path: imagePath, name: image.filename, stats });
    }
    if (files.length === 0) throw new NotFoundError('No valid image files found on disk');

    const zipPath = path.join(DATA_DIR, `temp-images-${randomUUID()}.zip`);
    let size: number;
    try {
        await writeZip(zipPath, files);
        ({ size } = await stat(zipPath));
    } catch (error) {
        console.error('Could not write the zip of images:', error);
        await rm(zipPath, { force: true });
        const unreadable = files.find((file) => file.path === (error as { path?: string }).path);
        if (!unreadable) throw error;
        throw new OperationFailedError(
            'image_unreadable',
            `Image file cannot be read: ${unreadable.name}`,
            { filename: unreadable.name }
        );
    }
    const zip = createReadStream(zipPath);
    // Once sent, or once the client hung up
    zip.on('close', () => {
        rm(zipPath, { force: true }).catch((error) =>
            console.error(`Could not remove the temporary zip ${zipPath}:`, error)
        );
    });
    const date = new Date().toISOString().slice(0, 10);
    return {
        filename: `wine-images-${date}.zip`,
        size,
        body: Readable.toWeb(zip) as ReadableStream<Uint8Array>
    };
}
