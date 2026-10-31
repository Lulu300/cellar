import { and, asc, eq, exists, inArray, isNull, sql } from 'drizzle-orm';
import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineImages, winePhotos, type WineImage } from '#lib/server/db/schema.js';
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

const wineColumns = {
    id: wineDefinitions.id,
    name: wineDefinitions.name,
    producer: wineDefinitions.producer
};

/** The wines that use one of these images, as their main photo or another one. */
export function winesUsingImages(imageIds: string[], tx: Tx = db) {
    const asMain = tx
        .select({ ...wineColumns, imageId: wineDefinitions.imageId })
        .from(wineDefinitions)
        .where(inArray(wineDefinitions.imageId, imageIds))
        .all();
    const asOther = tx
        .select({ ...wineColumns, imageId: winePhotos.imageId })
        .from(winePhotos)
        .innerJoin(wineDefinitions, eq(winePhotos.definitionId, wineDefinitions.id))
        .where(inArray(winePhotos.imageId, imageIds))
        .all();
    return [...asMain, ...asOther];
}

export function deleteImageRows(imageIds: string[], tx: Tx): void {
    tx.delete(wineImages).where(inArray(wineImages.id, imageIds)).run();
}

/** The id of the main photo of a wine (null when it has none), or undefined when there is no such wine. */
export function mainPhotoId(definitionId: string, tx: Tx = db): string | null | undefined {
    return tx
        .select({ imageId: wineDefinitions.imageId })
        .from(wineDefinitions)
        .where(eq(wineDefinitions.id, definitionId))
        .get()?.imageId;
}

export function setMainPhoto(definitionId: string, imageId: string | null, tx: Tx): void {
    tx.update(wineDefinitions)
        .set({ imageId, updatedAt: new Date() })
        .where(eq(wineDefinitions.id, definitionId))
        .run();
}

/** The photos of a wine besides its main one, oldest first. */
export function otherPhotos(definitionId: string, tx: Tx = db): WineImage[] {
    return tx
        .select({ image: wineImages })
        .from(winePhotos)
        .innerJoin(wineImages, eq(winePhotos.imageId, wineImages.id))
        .where(eq(winePhotos.definitionId, definitionId))
        .orderBy(asc(winePhotos.createdAt), sql`${winePhotos}.rowid`)
        .all()
        .map(({ image }) => image);
}

export function addOtherPhoto(definitionId: string, imageId: string, tx: Tx): void {
    tx.insert(winePhotos).values({ definitionId, imageId }).onConflictDoNothing().run();
}

/** Returns whether the image was one of the other photos of the wine. */
export function removeOtherPhoto(definitionId: string, imageId: string, tx: Tx): boolean {
    return (
        tx
            .delete(winePhotos)
            .where(and(eq(winePhotos.definitionId, definitionId), eq(winePhotos.imageId, imageId)))
            .run().changes > 0
    );
}

const photosOfWine = (tx: Tx) =>
    tx
        .select({ imageId: winePhotos.imageId })
        .from(winePhotos)
        .where(eq(winePhotos.definitionId, wineDefinitions.id));

/**
 * Keeps the photos of every wine in order after a change: a wine that has photos has a main one,
 * its oldest other photo when it lost its own, and its main photo is not one of its others.
 */
export function tidyWinePhotos(tx: Tx): void {
    tx.update(wineDefinitions)
        .set({
            imageId: sql`(${photosOfWine(tx)
                .orderBy(asc(winePhotos.createdAt), sql`${winePhotos}.rowid`)
                .limit(1)})`,
            updatedAt: new Date()
        })
        .where(and(isNull(wineDefinitions.imageId), exists(photosOfWine(tx))))
        .run();
    tx.delete(winePhotos)
        .where(
            exists(
                tx
                    .select({ id: wineDefinitions.id })
                    .from(wineDefinitions)
                    .where(
                        and(
                            eq(wineDefinitions.id, winePhotos.definitionId),
                            eq(wineDefinitions.imageId, winePhotos.imageId)
                        )
                    )
            )
        )
        .run();
}
