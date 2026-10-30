import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineImages } from '#lib/server/db/schema.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { MAX_WINE_IMAGE_BYTES } from '#lib/shared/images.js';
import { fakeEvent } from '../../../../test/event';
import { fileOf, jpegBytes } from '../../../../test/image';
import { POST } from './+server';

function upload(fields: [string, Blob][]) {
    const body = new FormData();
    for (const [name, value] of fields) body.append(name, value);
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/upload-image',
            routeId: '/api/admin/upload-image',
            body
        })
    );
}

describe('POST /api/admin/upload-image', () => {
    it('saves each image of `images` on its own, and reports the files that are not images', async () => {
        const bytes = jpegBytes('label');

        const response = await upload([
            ['images', fileOf('label.png', bytes)],
            ['images', fileOf('notes.txt', Buffer.from('not an image'))]
        ]);

        expect(response.status).toBe(201);
        const answer = await response.json();
        expect(answer).toEqual({
            success: true,
            message: 'Processed 2 images',
            successful: [
                {
                    originalFilename: 'label.png',
                    filename: expect.stringMatching(/^wine-[0-9a-f-]{36}\.jpg$/),
                    imageId: expect.any(String)
                }
            ],
            failed: [
                { filename: 'notes.txt', error: 'File must be a JPEG, PNG, WebP or GIF image' }
            ]
        });
        const [saved] = answer.successful;
        expect(readFileSync(path.join(IMAGES_DIR, saved.filename))).toEqual(bytes);
        expect(await db.select().from(wineImages)).toMatchObject([
            { id: saved.imageId, filename: saved.filename }
        ]);
    });

    it('takes a single image in `image`', async () => {
        const response = await upload([['image', fileOf('label.jpg', jpegBytes('single'))]]);

        expect(response.status).toBe(201);
        expect((await response.json()).successful).toEqual([
            expect.objectContaining({ originalFilename: 'label.jpg' })
        ]);
    });

    it('takes images up to the size limit of the wine form, and reports larger ones', async () => {
        const image = (size: number) => {
            const bytes = Buffer.alloc(size);
            jpegBytes('').copy(bytes);
            return bytes;
        };

        const response = await upload([
            ['images', fileOf('limit.jpg', image(MAX_WINE_IMAGE_BYTES))],
            ['images', fileOf('over.jpg', image(MAX_WINE_IMAGE_BYTES + 1))]
        ]);

        const answer = await response.json();
        expect(answer.successful).toEqual([
            expect.objectContaining({ originalFilename: 'limit.jpg' })
        ]);
        expect(answer.failed).toEqual([
            { filename: 'over.jpg', error: 'Image file too large (max 20 MB)' }
        ]);
    });

    it('answers 422 to a form without an image file', async () => {
        const response = await upload([['file', fileOf('label.jpg', jpegBytes('x'))]]);

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_body',
            details: [{ path: 'images', message: expect.any(String) }]
        });
    });
});
