import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readImageFile } from '#lib/server/features/images/service.js';
import { IMAGES_URL_PATH } from '#lib/server/paths.js';

export const GET: RequestHandler = async ({ params }) => {
    // Uploaded files are wine images only, served as IMAGES_URL_PATH<name>
    const urlPath = `/uploads/${params.path}`;
    const name = urlPath.startsWith(IMAGES_URL_PATH) ? urlPath.slice(IMAGES_URL_PATH.length) : null;
    const image = await readImageFile(name);

    if (!image) {
        error(404, 'File not found');
    }

    return new Response(image.bytes, {
        headers: {
            // Fixed by the extension, which nosniff makes the browser trust
            'Content-Type': image.contentType,
            'Content-Length': image.bytes.byteLength.toString(),
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            'Last-Modified': image.lastModified.toUTCString(),
            // An upload takes the extension of its content, but an image renamed in the admin, one
            // of an older version or of a zip import keeps the name it was given: never let the
            // browser sniff one as HTML
            'X-Content-Type-Options': 'nosniff'
        }
    });
};
