import { eq, inArray } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineImages, type WineImage } from '#lib/server/db/schema.js';
import { IMAGES_URL_PATH } from '#lib/server/paths.js';

export function listImages(): WineImage[] {
    return db.select().from(wineImages).all();
}

export function getImage(id: string): WineImage | undefined {
    return db.select().from(wineImages).where(eq(wineImages.id, id)).get();
}

export function getImages(ids: string[], tx: Tx = db): WineImage[] {
    return tx.select().from(wineImages).where(inArray(wineImages.id, ids)).all();
}

export function findImageByFilename(filename: string): WineImage | undefined {
    return db.select().from(wineImages).where(eq(wineImages.filename, filename)).get();
}

export function imageFilenames(): Set<string> {
    return new Set(
        db
            .select({ filename: wineImages.filename })
            .from(wineImages)
            .all()
            .map(({ filename }) => filename)
    );
}

export function insertImage(filename: string): WineImage {
    return db.insert(wineImages).values({ filename, path: IMAGES_URL_PATH }).returning().get();
}

export function renameImageRow(id: string, filename: string, tx: Tx = db): WineImage | undefined {
    return tx
        .update(wineImages)
        .set({ filename, updatedAt: new Date() })
        .where(eq(wineImages.id, id))
        .returning()
        .get();
}

/** The wines that use one of these images. */
export function winesUsingImages(imageIds: string[], tx: Tx = db) {
    return tx
        .select({
            id: wineDefinitions.id,
            name: wineDefinitions.name,
            producer: wineDefinitions.producer,
            imageId: wineDefinitions.imageId
        })
        .from(wineDefinitions)
        .where(inArray(wineDefinitions.imageId, imageIds))
        .all();
}

export function deleteImageRows(imageIds: string[], tx: Tx): void {
    tx.delete(wineImages).where(inArray(wineImages.id, imageIds)).run();
}
