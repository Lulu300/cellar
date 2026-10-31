import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { eq, ne } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineImages, winePhotos } from '#lib/server/db/schema.js';
import { deleteImages } from '#lib/server/features/images/service.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { encodedForm, fakeEvent } from '../../../../../test/event';
import { fileOf, jpegBytes } from '../../../../../test/image';
import { insertWineDefinition } from '../../../../../test/wine';
import { PUT as putWine } from '../+server';
import { PUT as putMain } from '../main-photo/+server';
import { DELETE } from './[imageId]/+server';
import { GET, POST } from './+server';

const WINE = 'margaux';

async function addPhoto(text: string, wineId = WINE) {
    const form = new FormData();
    form.append('image', fileOf('label.jpg', jpegBytes(text)));
    const { body, headers } = await encodedForm(form);
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            routeId: '/api/definitions/[id]/photos',
            params: { id: wineId },
            body,
            headers
        })
    );
}

/** Adds a photo and returns the id of its image. */
async function addedPhoto(text: string): Promise<string> {
    const { photos } = await (await addPhoto(text)).json();
    return photos.at(-1).imageId;
}

async function photos(): Promise<{ imageId: string; main: boolean }[]> {
    const response = await GET(
        fakeEvent<Parameters<typeof GET>[0]>({
            routeId: '/api/definitions/[id]/photos',
            params: { id: WINE }
        })
    );
    return (await response.json()).photos.map(({ imageId, main }: Record<string, unknown>) => ({
        imageId,
        main
    }));
}

const chooseMain = (imageId: unknown, wineId = WINE) =>
    putMain(
        fakeEvent<Parameters<typeof putMain>[0]>({
            method: 'PUT',
            routeId: '/api/definitions/[id]/main-photo',
            params: { id: wineId },
            body: { imageId }
        })
    );

const removePhoto = (imageId: string) =>
    DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            routeId: '/api/definitions/[id]/photos/[imageId]',
            params: { id: WINE, imageId }
        })
    );

const mainImageId = () =>
    db
        .select({ imageId: wineDefinitions.imageId })
        .from(wineDefinitions)
        .where(eq(wineDefinitions.id, WINE))
        .get()?.imageId;

/** Inserts another wine, like the first one. */
const insertWine = (id: string, imageId: string | null = null) =>
    db
        .insert(wineDefinitions)
        .values({ id, name: id, appellationId: 'mgx', typeId: 'still', colorId: 'red', imageId });

beforeAll(insertWineDefinition);

beforeEach(async () => {
    await db.delete(wineDefinitions).where(ne(wineDefinitions.id, WINE));
    // Takes the main photo (ON DELETE SET NULL) and the others (CASCADE) of the wine.
    await db.delete(wineImages);
    for (const name of readdirSync(IMAGES_DIR)) rmSync(path.join(IMAGES_DIR, name));
});

describe('POST /api/definitions/[id]/photos', () => {
    it('makes the first photo the main one, and adds the next ones after it', async () => {
        const first = await addPhoto('first');

        expect(first.status).toBe(201);
        const { photos: added } = await first.json();
        expect(added).toEqual([
            {
                imageId: expect.any(String),
                url: expect.stringMatching(/^\/uploads\/wines\/wine-/),
                main: true
            }
        ]);
        expect(mainImageId()).toBe(added[0].imageId);

        const second = await addedPhoto('second');
        const third = await addedPhoto('third');

        expect(await photos()).toEqual([
            { imageId: added[0].imageId, main: true },
            { imageId: second, main: false },
            { imageId: third, main: false }
        ]);
    });

    it('answers 404 for an unknown wine, without keeping the file', async () => {
        const response = await addPhoto('lost', 'unknown');

        expect(response.status).toBe(404);
        expect(readdirSync(IMAGES_DIR)).toEqual([]);
    });

    it('answers 422 for a file that is not an image', async () => {
        const form = new FormData();
        form.append('image', fileOf('notes.txt', Buffer.from('not an image')));
        const { body, headers } = await encodedForm(form);
        const response = await POST(
            fakeEvent<Parameters<typeof POST>[0]>({
                method: 'POST',
                routeId: '/api/definitions/[id]/photos',
                params: { id: WINE },
                body,
                headers
            })
        );

        expect(response.status).toBe(422);
        expect(await photos()).toEqual([]);
    });
});

describe('PUT /api/definitions/[id]/main-photo', () => {
    it('makes another photo the main one, and keeps the former main one among the others', async () => {
        const first = await addedPhoto('first');
        const second = await addedPhoto('second');

        const response = await chooseMain(second);

        expect(response.status).toBe(200);
        expect((await response.json()).photos).toMatchObject([
            { imageId: second, main: true },
            { imageId: first, main: false }
        ]);
        expect(mainImageId()).toBe(second);
    });

    it('answers 404 for an image that is not a photo of the wine, and 422 without an id', async () => {
        await addedPhoto('first');
        const elsewhere = await db
            .insert(wineImages)
            .values({ filename: 'other.jpg' })
            .returning()
            .get();

        expect((await chooseMain(elsewhere.id)).status).toBe(404);
        expect((await chooseMain(undefined)).status).toBe(422);
        expect((await chooseMain(elsewhere.id, 'unknown')).status).toBe(404);
    });
});

describe('DELETE /api/definitions/[id]/photos/[imageId]', () => {
    it('removes a photo and deletes its image, the next photo becoming the main one', async () => {
        const first = await addedPhoto('first');
        const second = await addedPhoto('second');
        const [image] = await db.select().from(wineImages).where(eq(wineImages.id, first));

        const response = await removePhoto(first);

        expect(response.status).toBe(204);
        expect(await photos()).toEqual([{ imageId: second, main: true }]);
        expect(await db.select().from(winePhotos)).toEqual([]);
        expect(await db.select().from(wineImages).where(eq(wineImages.id, first))).toEqual([]);
        expect(existsSync(path.join(IMAGES_DIR, image.filename))).toBe(false);
    });

    it('keeps the image that another wine uses', async () => {
        const photo = await addedPhoto('shared');
        await insertWine('pavie', photo);

        expect((await removePhoto(photo)).status).toBe(204);

        expect(await photos()).toEqual([]);
        expect(await db.select().from(wineImages)).toHaveLength(1);
    });

    it('answers 404 for an image that is not a photo of the wine', async () => {
        await addedPhoto('first');

        expect((await removePhoto('unknown')).status).toBe(404);
        expect(await photos()).toHaveLength(1);
    });
});

describe('the other photos of a wine', () => {
    it('stay when the wine is saved with another main photo, the former one among them', async () => {
        const first = await addedPhoto('first');
        const second = await addedPhoto('second');
        const third = await addedPhoto('third');
        const wine = db.select().from(wineDefinitions).where(eq(wineDefinitions.id, WINE)).get();

        const response = await putWine(
            fakeEvent<Parameters<typeof putWine>[0]>({
                method: 'PUT',
                routeId: '/api/definitions/[id]',
                params: { id: WINE },
                body: { ...wine, imageId: third }
            })
        );

        expect(response.status).toBe(200);
        expect((await response.json()).imageId).toBe(third);
        // As « Make it the main photo » does: no photo leaves the wine unasked.
        expect(await photos()).toEqual([
            { imageId: third, main: true },
            { imageId: second, main: false },
            { imageId: first, main: false }
        ]);
    });

    it('give a wine saved without its main photo the next one', async () => {
        await addedPhoto('first');
        const second = await addedPhoto('second');
        const wine = db.select().from(wineDefinitions).where(eq(wineDefinitions.id, WINE)).get();

        const response = await putWine(
            fakeEvent<Parameters<typeof putWine>[0]>({
                method: 'PUT',
                routeId: '/api/definitions/[id]',
                params: { id: WINE },
                body: { ...wine, imageId: null }
            })
        );

        expect((await response.json()).imageId).toBe(second);
        expect(await photos()).toEqual([{ imageId: second, main: true }]);
    });

    it('give the next one to a wine whose main photo Admin › Images deletes', async () => {
        const first = await addedPhoto('first');
        const second = await addedPhoto('second');
        const third = await addedPhoto('third');

        await expect(deleteImages([first, third], false)).rejects.toMatchObject({
            code: 'in_use',
            details: {
                // The main photo and another one alike
                inUse: expect.arrayContaining(
                    [first, third].map((id) =>
                        expect.objectContaining({
                            id,
                            wines: [expect.objectContaining({ id: WINE })]
                        })
                    )
                )
            }
        });
        await deleteImages([first, third], true);

        expect(await photos()).toEqual([{ imageId: second, main: true }]);
    });

    it('go with their wine', async () => {
        await insertWine('pavie');
        await addPhoto('first', 'pavie');
        await addPhoto('second', 'pavie');

        await db.delete(wineDefinitions).where(eq(wineDefinitions.id, 'pavie'));

        expect(await db.select().from(winePhotos)).toEqual([]);
        expect(await db.select().from(wineImages)).toHaveLength(2);
    });
});
