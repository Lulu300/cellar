import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { eq, ne } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineImages, wishes } from '#lib/server/db/schema.js';
import { deleteDefinitionAndBottles } from '#lib/server/features/catalog/service.js';
import { deleteImages, uploadImage } from '#lib/server/features/images/service.js';
import { wishlistSummary } from '#lib/server/features/wishlist/service.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../test/event';
import { fileOf, jpegBytes } from '../../../test/image';
import { insertBottles, insertWineDefinition } from '../../../test/wine';
import { DELETE, PUT } from './[id]/+server';
import { GET, POST } from './+server';

const WINE = 'margaux';

const post = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            routeId: '/api/wishes',
            body
        })
    );

/** Adds a wish and returns it as the API answers it. */
async function added(body: unknown) {
    const response = await post(body);
    expect(response.status).toBe(201);
    return response.json();
}

const put = (id: string, body: unknown) =>
    PUT(
        fakeEvent<Parameters<typeof PUT>[0]>({
            method: 'PUT',
            routeId: '/api/wishes/[id]',
            params: { id },
            body
        })
    );

const remove = (id: string) =>
    DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            routeId: '/api/wishes/[id]',
            params: { id }
        })
    );

async function list() {
    return (await GET(fakeEvent<Parameters<typeof GET>[0]>({ routeId: '/api/wishes' }))).json();
}

/** Stores a photo as the wishlist sends it, and returns the id of its image. */
async function photo(text: string): Promise<string> {
    return (await uploadImage(fileOf('label.jpg', jpegBytes(text)))).imageId;
}

const imageExists = (id: string) =>
    db.select().from(wineImages).where(eq(wineImages.id, id)).get() !== undefined;

const errorCode = async (response: Response) => (await response.json()).error.code;

beforeAll(insertWineDefinition);

beforeEach(async () => {
    await db.delete(wishes);
    await db.delete(wineDefinitions).where(ne(wineDefinitions.id, WINE));
    await db.delete(wineImages);
    for (const name of readdirSync(IMAGES_DIR)) rmSync(path.join(IMAGES_DIR, name));
});

describe('POST /api/wishes', () => {
    it('adds a wine with its bottles in the cellar, or a text with its photo', async () => {
        const { AVAILABLE, OUT_OF_CELLAR } = BottleAvailability;
        await insertBottles(WINE, [{ availability: AVAILABLE }, { availability: OUT_OF_CELLAR }]);
        const imageId = await photo('label');

        const wine = await added({ definitionId: WINE, quantity: 6, note: 'For the wedding' });
        const text = await added({ text: '  Clos Rougeard  ', imageId });

        expect(wine).toMatchObject({
            text: null,
            imageId: null,
            imageUrl: null,
            quantity: 6,
            note: 'For the wedding',
            wine: {
                id: WINE,
                name: 'Château Margaux',
                color: 'Red',
                type: 'Still',
                appellation: 'Margaux',
                region: 'Bordeaux',
                country: 'France',
                imageUrl: null,
                inCellar: 1
            }
        });
        expect(text).toMatchObject({
            text: 'Clos Rougeard',
            imageId,
            imageUrl: expect.stringMatching(/^\/uploads\/wines\/wine-/),
            quantity: null,
            note: null,
            wine: null
        });
        // The newest first
        expect((await list()).map((wish: { id: string }) => wish.id)).toEqual([text.id, wine.id]);
    });

    it('refuses a wish that is both a wine and a text, or neither, or a wine with a photo', async () => {
        const imageId = await photo('label');

        for (const body of [
            { definitionId: WINE, text: 'Margaux' },
            { quantity: 2 },
            { text: '   ' },
            { definitionId: WINE, imageId },
            { text: 'Clos Rougeard', quantity: 0 }
        ]) {
            const response = await post(body);
            expect(response.status).toBe(422);
            expect(await errorCode(response)).toBe('invalid_body');
        }
        expect(await list()).toEqual([]);
    });

    it('takes a wine once', async () => {
        const first = await added({ definitionId: WINE });

        const second = await post({ definitionId: WINE, quantity: 3 });

        expect(second.status).toBe(409);
        expect(await second.json()).toMatchObject({
            error: { code: 'duplicate_wish', details: { wishId: first.id } }
        });
    });

    it('refuses an unknown wine or photo, naming it', async () => {
        for (const [field, body] of [
            ['definitionId', { definitionId: 'unknown' }],
            ['imageId', { text: 'Clos', imageId: 'unknown' }]
        ] as const) {
            const response = await post(body);
            expect(response.status).toBe(409);
            expect((await response.json()).error).toMatchObject({
                code: 'missing_reference',
                details: [{ field, id: 'unknown' }]
            });
        }
    });
});

describe('PUT /api/wishes/[id]', () => {
    it('links a text wish to the wine created from it, which keeps its photo', async () => {
        const imageId = await photo('label');
        const wish = await added({ text: 'Clos Rougeard', imageId, quantity: 2, note: 'Saumur' });
        // The wine form created the wine with the photo of the wish as its main photo
        await db.insert(wineDefinitions).values({
            id: 'clos',
            name: 'Clos Rougeard',
            appellationId: 'mgx',
            typeId: 'still',
            colorId: 'red',
            imageId
        });

        const response = await put(wish.id, { definitionId: 'clos', quantity: 2, note: 'Saumur' });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            id: wish.id,
            text: null,
            imageId: null,
            quantity: 2,
            note: 'Saumur',
            wine: { id: 'clos', name: 'Clos Rougeard', imageUrl: wish.imageUrl }
        });
        expect(imageExists(imageId)).toBe(true);
        expect(wishlistSummary()).toEqual({ wishCount: 1, wishedWines: { clos: wish.id } });
    });

    it('deletes the photo that the wish no longer has and nothing else uses', async () => {
        const imageId = await photo('label');
        const wish = await added({ text: 'Clos Rougeard', imageId });

        expect((await put(wish.id, { text: 'Clos Rougeard', imageId: null })).status).toBe(200);

        expect(imageExists(imageId)).toBe(false);
        expect(readdirSync(IMAGES_DIR)).toEqual([]);
    });

    it('refuses a wine that another wish has, and an unknown wish', async () => {
        await added({ definitionId: WINE });
        const text = await added({ text: 'Margaux' });

        const taken = await put(text.id, { definitionId: WINE });
        const unknown = await put('unknown', { text: 'Margaux' });

        expect(taken.status).toBe(409);
        expect(await errorCode(taken)).toBe('duplicate_wish');
        expect(unknown.status).toBe(404);
    });

    it('refuses an unknown wine, naming it', async () => {
        const text = await added({ text: 'Margaux' });

        const response = await put(text.id, { definitionId: 'unknown' });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'missing_reference',
            details: [{ field: 'definitionId', id: 'unknown' }]
        });
    });
});

describe('DELETE /api/wishes/[id]', () => {
    it('removes the wish, and its photo unless a wine uses it', async () => {
        const lonely = await photo('lonely');
        const shared = await photo('shared');
        await db
            .update(wineDefinitions)
            .set({ imageId: shared })
            .where(eq(wineDefinitions.id, WINE));
        const first = await added({ text: 'Clos Rougeard', imageId: lonely });
        const second = await added({ text: 'Margaux again', imageId: shared });

        expect((await remove(first.id)).status).toBe(204);
        expect((await remove(second.id)).status).toBe(204);

        expect(await list()).toEqual([]);
        expect(imageExists(lonely)).toBe(false);
        expect(imageExists(shared)).toBe(true);
        expect(readdirSync(IMAGES_DIR)).toHaveLength(1);
        await db.update(wineDefinitions).set({ imageId: null }).where(eq(wineDefinitions.id, WINE));
    });

    it('answers 404 for an unknown wish', async () => {
        expect((await remove('unknown')).status).toBe(404);
    });
});

describe('the wishes and the rest of the cellar', () => {
    it('leaves the wishlist with the wine deleted', async () => {
        await db.insert(wineDefinitions).values({
            id: 'gone',
            name: 'Gone',
            appellationId: 'mgx',
            typeId: 'still',
            colorId: 'red'
        });
        await added({ definitionId: 'gone' });

        deleteDefinitionAndBottles('gone', false);

        expect(await list()).toEqual([]);
    });

    it('keeps the photo of a wish out of the unused images until the user confirms', async () => {
        const imageId = await photo('label');
        const wish = await added({ text: 'Clos Rougeard', imageId });

        await expect(deleteImages([imageId], false)).rejects.toMatchObject({
            status: 409,
            code: 'in_use',
            details: {
                inUse: [
                    {
                        id: imageId,
                        wines: [],
                        wishes: [{ id: wish.id, name: 'Clos Rougeard' }]
                    }
                ]
            }
        });

        await deleteImages([imageId], true);
        expect(await list()).toMatchObject([{ id: wish.id, imageId: null, imageUrl: null }]);
        expect(existsSync(path.join(IMAGES_DIR, path.basename(wish.imageUrl)))).toBe(false);
    });
});
