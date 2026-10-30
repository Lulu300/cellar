import { chmodSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { extractZip } from '#lib/server/zip.js';
import { filenameFromContentDisposition } from '#lib/utils/content-disposition.js';
import { fakeEvent } from '../../../../test/event';
import { insertImageRow, jpegBytes } from '../../../../test/image';
import { POST } from './+server';

const download = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/download-images',
            routeId: '/api/admin/download-images',
            body
        })
    );

describe('POST /api/admin/download-images', () => {
    beforeAll(async () => {
        for (const id of ['first', 'second', 'lost']) {
            await insertImageRow(id, `${id}.jpg`);
            writeFileSync(path.join(IMAGES_DIR, `${id}.jpg`), jpegBytes(id));
        }
        rmSync(path.join(IMAGES_DIR, 'lost.jpg'));
    });

    it('answers a zip of the files of the images asked for, leaving out those it cannot find', async () => {
        const response = await download({ imageIds: ['second', 'unknown', 'lost', 'first'] });

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/zip');
        expect(filenameFromContentDisposition(response.headers.get('Content-Disposition'))).toMatch(
            /^wine-images-\d{4}-\d{2}-\d{2}\.zip$/
        );
        const zipPath = path.join(DATA_DIR, 'images.zip');
        const zip = Buffer.from(await response.arrayBuffer());
        expect(response.headers.get('Content-Length')).toBe(String(zip.length));
        writeFileSync(zipPath, zip);
        const extractDir = path.join(DATA_DIR, 'extracted');
        expect(await extractZip(zipPath, extractDir, () => true)).toEqual([
            'second.jpg',
            'first.jpg'
        ]);
        expect(readFileSync(path.join(extractDir, 'first.jpg'))).toEqual(jpegBytes('first'));
    });

    it.each([
        ['ids that match no image', ['unknown']],
        ['images whose files are all missing', ['lost']]
    ])('answers 404 to %s', async (_case, imageIds) => {
        const response = await download({ imageIds });

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });

    // root reads any file, whatever its mode
    it.skipIf(process.getuid?.() === 0)(
        'answers 500 naming an image whose file cannot be read, before sending any of the zip',
        async () => {
            const file = path.join(IMAGES_DIR, 'second.jpg');
            chmodSync(file, 0);
            try {
                const response = await download({ imageIds: ['first', 'second'] });

                expect(response.status).toBe(500);
                expect((await response.json()).error).toMatchObject({
                    code: 'image_unreadable',
                    details: { filename: 'second.jpg' }
                });
                // Its temporary zip is gone.
                expect(readdirSync(DATA_DIR).filter((name) => name.startsWith('temp-'))).toEqual(
                    []
                );
            } finally {
                chmodSync(file, 0o644);
            }
        }
    );
});
