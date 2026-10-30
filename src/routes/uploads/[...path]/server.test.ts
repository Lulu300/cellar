import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { isHttpError } from '@sveltejs/kit';
import { beforeAll, describe, expect, it } from 'vitest';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../test/event';
import { jpegBytes } from '../../../test/image';
import { GET } from './+server';

/** The answer to GET /uploads/<urlPath>, with the parameter decoded as SvelteKit gives it. */
async function get(urlPath: string): Promise<Response> {
    try {
        return await GET(
            fakeEvent<Parameters<typeof GET>[0]>({
                path: `/uploads/${urlPath}`,
                routeId: '/uploads/[...path]',
                params: { path: urlPath }
            })
        );
    } catch (error) {
        // error(404) throws
        if (isHttpError(error)) return new Response(null, { status: error.status });
        throw error;
    }
}

describe('GET /uploads/wines/<name>', () => {
    beforeAll(() => {
        writeFileSync(path.join(IMAGES_DIR, 'label.jpg'), jpegBytes('label'));
        writeFileSync(path.join(IMAGES_DIR, 'Château #1?.PNG'), 'png');
        writeFileSync(path.join(IMAGES_DIR, 'old.bmp'), 'BM');
        writeFileSync(path.join(DATA_DIR, 'secret.txt'), 'secret');
    });

    it('serves the image with its type, size and caching, never to be sniffed', async () => {
        const response = await get('wines/label.jpg');

        expect(response.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toMatchObject({
            'content-type': 'image/jpeg',
            'content-length': String(jpegBytes('label').length),
            'cache-control': 'public, max-age=31536000',
            'x-content-type-options': 'nosniff'
        });
        expect(response.headers.get('last-modified')).toBeTruthy();
        expect(Buffer.from(await response.arrayBuffer())).toEqual(jpegBytes('label'));
    });

    it('serves a name holding a space, an accent, `#` and `?`, by its extension in any case', async () => {
        const response = await get('wines/Château #1?.PNG');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/png');
    });

    it('serves a file of another format, such as BMP, as bytes rather than an image', async () => {
        const response = await get('wines/old.bmp');

        expect(response.headers.get('content-type')).toBe('application/octet-stream');
    });

    it.each([
        ['a missing file', 'wines/missing.jpg'],
        ['a parent folder', 'wines/../../data/secret.txt'],
        ['`..` itself', 'wines/..'],
        ['a hidden file', 'wines/.label.jpg'],
        ['a sub-folder', 'wines/sub/label.jpg'],
        ['a folder other than wines/', 'label.jpg']
    ])('answers 404 to %s', async (_case, urlPath) => {
        expect((await get(urlPath)).status).toBe(404);
    });
});
