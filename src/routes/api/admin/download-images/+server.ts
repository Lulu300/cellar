import type { RequestHandler } from './$types';
import { attachmentResponse } from '#lib/server/content-disposition.js';
import { zipImages } from '#lib/server/features/images/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { imagesDownloadRequest } from '#lib/server/http/request-schemas.js';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const { imageIds } = await parseBody(request, imagesDownloadRequest);
    const { filename, size, body } = await zipImages(imageIds);
    return attachmentResponse(body, filename, 'application/zip', {
        'Content-Length': String(size)
    });
});
