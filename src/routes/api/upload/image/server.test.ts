import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineImages } from '#lib/server/db/schema.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { MAX_WINE_IMAGE_BYTES } from '#lib/shared/images.js';
import { encodedForm, fakeEvent } from '../../../../test/event';
import { fileOf, jpegBytes } from '../../../../test/image';
import { POST } from './+server';

async function upload(fields: Record<string, Blob>) {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);
    const { body, headers } = await encodedForm(form);
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/upload/image',
            routeId: '/api/upload/image',
            body,
            headers
        })
    );
}

describe('POST /api/upload/image', () => {
    it('stores the image under a new name, by its content, and answers its id and URL', async () => {
        const bytes = jpegBytes('label');
        // The name and type the client gives are not what decides.
        const response = await upload({
            image: new File([new Uint8Array(bytes)], 'label.png', { type: 'image/png' })
        });

        expect(response.status).toBe(201);
        const answer = await response.json();
        expect(answer).toEqual({
            imageId: expect.any(String),
            url: `/uploads/wines/${answer.filename}`,
            filename: expect.stringMatching(/^wine-[0-9a-f-]{36}\.jpg$/),
            size: bytes.length,
            type: 'image/jpeg'
        });
        expect(readFileSync(path.join(IMAGES_DIR, answer.filename))).toEqual(bytes);
        expect(await db.select().from(wineImages)).toMatchObject([
            { id: answer.imageId, filename: answer.filename }
        ]);
    });

    it.each([
        ['no `image` field', { file: fileOf('x.jpg', jpegBytes('x')) }],
        ['a file that is not an image', { image: new File(['<svg/>'], 'x.jpg') }]
    ])('answers 422 to %s', async (_, fields) => {
        const response = await upload(fields);

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_body',
            details: [{ path: 'image', message: expect.any(String) }]
        });
    });

    // 20,970,603 bytes: the image of the audit
    it.each([20_970_603, MAX_WINE_IMAGE_BYTES])(
        'takes an image of %i bytes, which the form around it may push over the limit',
        async (size) => {
            const bytes = Buffer.alloc(size);
            jpegBytes('').copy(bytes);

            const response = await upload({ image: fileOf('big.jpg', bytes) });

            expect(response.status).toBe(201);
            expect((await response.json()).size).toBe(size);
        }
    );

    it('answers 413 to an image over the size limit', async () => {
        const bytes = Buffer.alloc(MAX_WINE_IMAGE_BYTES + 1);
        jpegBytes('').copy(bytes);

        const response = await upload({ image: fileOf('big.jpg', bytes) });

        expect(response.status).toBe(413);
        expect((await response.json()).error.code).toBe('body_too_large');
    });
});
