import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { fileOf, insertImageRow, jpegBytes } from '../../../../test/image';
import { buildZip } from '../../../../test/zip';
import { POST } from './+server';

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function importZip(fields: Record<string, Blob>) {
    const body = new FormData();
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/import-images-zip',
            routeId: '/api/admin/import-images-zip',
            body
        })
    );
}

describe('POST /api/admin/import-images-zip', () => {
    beforeAll(async () => {
        await insertImageRow('known', 'known.jpg');
        await insertImageRow('fake', 'fake.jpg');
        await insertImageRow('bitmap', 'old.bmp');
        await insertImageRow('twice', 'twice.png');
    });

    it('copies the images whose name an image row has, and skips the others', async () => {
        const zip = buildZip([
            { name: 'images/known.jpg', data: jpegBytes('known') },
            // Some tar tools put `./` before each name
            { name: './stranger.png', data: jpegBytes('stranger') },
            // Left out: what a Mac or a file manager adds to a zip
            { name: '__MACOSX/images/._known.jpg', data: Buffer.from('fork') },
            { name: 'images/.DS_Store', data: Buffer.from('finder') }
        ]);

        const response = await importZip({ zipFile: fileOf('images.zip', zip) });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({
            success: true,
            message: 'ZIP import completed. 1 successful, 1 skipped, 0 errors',
            successful: 1,
            skipped: 1,
            errors: 0,
            summary: [
                {
                    filename: 'known.jpg',
                    status: 'success',
                    reason: 'image_imported_successfully'
                },
                {
                    filename: 'stranger.png',
                    status: 'skipped',
                    reason: 'filename_not_found_in_database'
                }
            ],
            totalProcessed: 2
        });
        expect(readFileSync(path.join(IMAGES_DIR, 'known.jpg'))).toEqual(jpegBytes('known'));
        expect(existsSync(path.join(IMAGES_DIR, 'stranger.png'))).toBe(false);
        // Its temporary copies are gone.
        expect(readdirSync(DATA_DIR).filter((name) => name.startsWith('temp-'))).toEqual([]);
    });

    it('reports, without copying them, the files that are not JPEG, PNG, WebP or GIF images', async () => {
        const zip = buildZip([
            // Text named like an image
            { name: 'images/fake.jpg', data: Buffer.from('<html>not an image</html>') },
            // BMP, which the app no longer accepts
            { name: 'images/old.bmp', data: Buffer.from('BM\x00\x00\x00\x00') },
            { name: 'readme.txt', data: Buffer.from('notes') }
        ]);

        const response = await importZip({ zipFile: fileOf('images.zip', zip) });

        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({
            successful: 0,
            skipped: 0,
            errors: 3,
            summary: [
                { filename: 'fake.jpg', status: 'error', reason: 'not_an_image' },
                { filename: 'old.bmp', status: 'error', reason: 'not_an_image' },
                { filename: 'readme.txt', status: 'error', reason: 'not_an_image' }
            ],
            totalProcessed: 3
        });
        expect(existsSync(path.join(IMAGES_DIR, 'fake.jpg'))).toBe(false);
        expect(existsSync(path.join(IMAGES_DIR, 'old.bmp'))).toBe(false);
    });

    it('copies the first of two files of the same name, and reports the second', async () => {
        const zip = buildZip([
            { name: 'images/twice.png', data: pngBytes },
            { name: 'other/folder/twice.png', data: Buffer.concat([pngBytes, Buffer.from('2')]) }
        ]);

        const response = await importZip({ zipFile: fileOf('images.zip', zip) });

        expect((await response.json()).summary).toEqual([
            { filename: 'twice.png', status: 'success', reason: 'image_imported_successfully' },
            { filename: 'twice.png', status: 'error', reason: 'duplicate_filename' }
        ]);
        expect(readFileSync(path.join(IMAGES_DIR, 'twice.png'))).toEqual(pngBytes);
    });

    it.each([
        ['no `zipFile` field', { file: fileOf('images.zip', buildZip([])) }],
        ['a file not named .zip', { zipFile: fileOf('images.tar', buildZip([])) }],
        ['an empty zip', { zipFile: fileOf('images.zip', buildZip([{ name: 'folder/' }])) }],
        ['a file that is not a zip', { zipFile: fileOf('images.zip', Buffer.from('not a zip')) }]
    ])('answers 422 to %s', async (_case, fields) => {
        const response = await importZip(fields);

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_body',
            details: [{ path: 'zipFile', message: expect.any(String) }]
        });
    });
});
