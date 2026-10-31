import { chmodSync, existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions, wineImages } from '#lib/server/db/schema.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { failWrites } from '../../../../test/failing-write';
import { insertImageRow } from '../../../../test/image';
import { insertWineDefinition } from '../../../../test/wine';
import { DELETE, GET, PUT } from './+server';

function deleteImages(body: unknown) {
    return DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            path: '/api/admin/images',
            routeId: '/api/admin/images',
            body
        })
    );
}

async function insertImage(id: string) {
    await insertImageRow(id, `${id}.jpg`);
    writeFileSync(path.join(IMAGES_DIR, `${id}.jpg`), 'image');
}

async function imageIds() {
    return (await db.select().from(wineImages)).map((image) => image.id).sort();
}

const imageFileExists = (id: string) => existsSync(path.join(IMAGES_DIR, `${id}.jpg`));

/** Leaves the images first, second and third, rows and files, used by no wine. */
async function resetImages() {
    await db.update(wineDefinitions).set({ imageId: null });
    await db.delete(wineImages);
    rmSync(IMAGES_DIR, { recursive: true, force: true });
    mkdirSync(IMAGES_DIR, { recursive: true });
    await insertImage('first');
    await insertImage('second');
    await insertImage('third');
}

let wineId: string;

beforeAll(async () => {
    wineId = await insertWineDefinition();
});

beforeEach(resetImages);

describe('GET /api/admin/images', () => {
    it('lists every image with its file size and date and the wines using it, newest file first', async () => {
        const date = (iso: string) => new Date(iso);
        utimesSync(path.join(IMAGES_DIR, 'first.jpg'), date('2026-03-01'), date('2026-03-01'));
        utimesSync(path.join(IMAGES_DIR, 'second.jpg'), date('2026-05-01'), date('2026-05-01'));
        rmSync(path.join(IMAGES_DIR, 'third.jpg'));
        // An image without its file is dated by its row.
        await db
            .update(wineImages)
            .set({ updatedAt: date('2026-04-01') })
            .where(eq(wineImages.id, 'third'));
        await db
            .update(wineDefinitions)
            .set({ imageId: 'second' })
            .where(eq(wineDefinitions.id, wineId));

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/admin/images' })
        );

        expect(response.status).toBe(200);
        const { images, count } = await response.json();
        expect(count).toBe(3);
        expect(images.map((image: { id: string }) => image.id)).toEqual([
            'second',
            'third',
            'first'
        ]);
        expect(images[0]).toMatchObject({
            id: 'second',
            filename: 'second.jpg',
            path: '/uploads/wines/',
            url: '/uploads/wines/second.jpg',
            size: 5,
            lastModified: '2026-05-01T00:00:00.000Z',
            wines: [{ id: wineId, name: 'Château Margaux', producer: null }]
        });
        expect(images[1]).toMatchObject({
            size: 0,
            lastModified: '2026-04-01T00:00:00.000Z',
            wines: []
        });
    });
});

describe('PUT /api/admin/images', () => {
    const rename = (body: unknown) =>
        PUT(
            fakeEvent<Parameters<typeof PUT>[0]>({
                method: 'PUT',
                path: '/api/admin/images',
                routeId: '/api/admin/images',
                body
            })
        );

    it('renames the image and its file, and names the wines that use it', async () => {
        await db
            .update(wineDefinitions)
            .set({ imageId: 'first' })
            .where(eq(wineDefinitions.id, wineId));

        const response = await rename({ imageId: 'first', newFilename: 'margaux label.jpg' });

        expect(response.status).toBe(200);
        // The image as the list gives it.
        expect(await response.json()).toEqual({
            id: 'first',
            filename: 'margaux label.jpg',
            path: '/uploads/wines/',
            url: '/uploads/wines/margaux%20label.jpg',
            size: 5,
            lastModified: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            wines: [{ id: wineId, name: 'Château Margaux', producer: null }],
            wishes: []
        });
        expect(imageFileExists('first')).toBe(false);
        expect(existsSync(path.join(IMAGES_DIR, 'margaux label.jpg'))).toBe(true);
    });

    it.each([
        [
            'a name that leaves the folder',
            { imageId: 'first', newFilename: '../x.jpg' },
            422,
            'invalid_file_name'
        ],
        [
            'a name of 300 characters',
            { imageId: 'first', newFilename: `${'a'.repeat(296)}.jpg` },
            422,
            'invalid_file_name'
        ],
        [
            'a name of 128 characters but 256 bytes',
            { imageId: 'first', newFilename: `${'é'.repeat(126)}.jpg` },
            422,
            'invalid_file_name'
        ],
        [
            'a name without an image extension',
            { imageId: 'first', newFilename: 'label.txt' },
            422,
            'invalid_file_name'
        ],
        [
            'a hidden file name',
            { imageId: 'first', newFilename: '.x.jpg' },
            422,
            'invalid_file_name'
        ],
        [
            'an image that does not exist',
            { imageId: 'unknown', newFilename: 'x.jpg' },
            404,
            'not_found'
        ],
        [
            "another image's name",
            { imageId: 'first', newFilename: 'second.jpg' },
            409,
            'duplicate_name'
        ],
        ['an empty name', { imageId: 'first', newFilename: '' }, 422, 'invalid_body']
    ])('answers an error to %s, and renames nothing', async (_case, body, status, code) => {
        const response = await rename(body);

        expect(response.status).toBe(status);
        expect((await response.json()).error.code).toBe(code);
        expect(imageFileExists('first')).toBe(true);
    });

    it('accepts a name of 255 bytes with an image extension in capitals', async () => {
        const newFilename = `${'é'.repeat(125)}.JPEG`;

        const response = await rename({ imageId: 'first', newFilename });

        expect(response.status).toBe(200);
        expect(existsSync(path.join(IMAGES_DIR, newFilename))).toBe(true);
    });

    it('keeps the file under its name when the row cannot be renamed', async () => {
        failWrites('UPDATE', 'wine_images', "NEW.filename = 'renamed.jpg'");

        const response = await rename({ imageId: 'first', newFilename: 'renamed.jpg' });

        expect(response.status).toBe(500);
        expect(imageFileExists('first')).toBe(true);
        expect(existsSync(path.join(IMAGES_DIR, 'renamed.jpg'))).toBe(false);
        const [row] = await db.select().from(wineImages).where(eq(wineImages.id, 'first'));
        expect(row.filename).toBe('first.jpg');
    });

    // root writes in any folder, whatever its mode
    it.skipIf(process.getuid?.() === 0)(
        'keeps the row under its name when the file cannot be renamed',
        async () => {
            chmodSync(IMAGES_DIR, 0o555);
            try {
                const response = await rename({ imageId: 'first', newFilename: 'renamed.jpg' });

                expect(response.status).toBe(500);
            } finally {
                chmodSync(IMAGES_DIR, 0o755);
            }
            const [row] = await db.select().from(wineImages).where(eq(wineImages.id, 'first'));
            expect(row.filename).toBe('first.jpg');
            expect(imageFileExists('first')).toBe(true);
        }
    );
});

describe('DELETE /api/admin/images', () => {
    it('deletes every image of the list, rows and files', async () => {
        const response = await deleteImages({ imageIds: ['first', 'second'] });

        expect(response.status).toBe(204);
        expect(await response.text()).toBe('');
        expect(await imageIds()).toEqual(['third']);
        expect(imageFileExists('first')).toBe(false);
        expect(imageFileExists('second')).toBe(false);
        expect(imageFileExists('third')).toBe(true);
    });

    it('answers 409 with the wines using an image, and deletes nothing', async () => {
        await db
            .update(wineDefinitions)
            .set({ imageId: 'second' })
            .where(eq(wineDefinitions.id, wineId));

        const response = await deleteImages({ imageIds: ['first', 'second'] });

        expect(response.status).toBe(409);
        expect((await response.json()).error.details.inUse).toEqual([
            {
                id: 'second',
                filename: 'second.jpg',
                wines: [{ id: wineId, name: 'Château Margaux', producer: null }],
                wishes: []
            }
        ]);
        expect(await imageIds()).toEqual(['first', 'second', 'third']);
        expect(imageFileExists('first')).toBe(true);
    });

    it('with force, removes the images from the wines using them, then deletes them', async () => {
        await db
            .update(wineDefinitions)
            .set({ imageId: 'second' })
            .where(eq(wineDefinitions.id, wineId));

        const response = await deleteImages({ imageIds: ['first', 'second'], force: true });

        expect(response.status).toBe(204);
        expect(await imageIds()).toEqual(['third']);
        expect(imageFileExists('second')).toBe(false);
        const [wine] = await db
            .select()
            .from(wineDefinitions)
            .where(eq(wineDefinitions.id, wineId));
        expect(wine.imageId).toBeNull();
    });

    it('ignores ids that match no image, such as one another tab already deleted', async () => {
        const response = await deleteImages({ imageIds: ['first', 'unknown'] });

        expect(response.status).toBe(204);
        expect(await imageIds()).toEqual(['second', 'third']);
    });

    it('deletes an image listed twice', async () => {
        const response = await deleteImages({ imageIds: ['first', 'first'] });

        expect(response.status).toBe(204);
        expect(await imageIds()).toEqual(['second', 'third']);
    });

    it('deletes the row of an image whose file is already missing', async () => {
        rmSync(path.join(IMAGES_DIR, 'first.jpg'));

        const response = await deleteImages({ imageIds: ['first'] });

        expect(response.status).toBe(204);
        expect(await imageIds()).toEqual(['second', 'third']);
    });

    it.each([
        ['no body', undefined, 422],
        ['a body that is not JSON', '{', 400],
        ['a single imageId', { imageId: 'first' }, 422],
        ['an empty list', { imageIds: [] }, 422],
        ['a list holding something other than an id', { imageIds: ['first', 42] }, 422],
        ['an empty id', { imageIds: [''] }, 422],
        ['a force that is not a boolean', { imageIds: ['first'], force: 'yes' }, 422]
    ])('answers an error to %s', async (_case, body, status) => {
        const response = await deleteImages(body);

        expect(response.status).toBe(status);
        expect(await imageIds()).toEqual(['first', 'second', 'third']);
    });
});
