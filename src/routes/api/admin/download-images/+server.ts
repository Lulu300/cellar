import { z } from 'zod';
import type { RequestHandler } from './$types';
import { attachmentResponse } from '#lib/server/content-disposition.js';
import { zipImages } from '#lib/server/features/images/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

const downloadSchema = z.object({ imageIds: z.array(z.string()).min(1).max(10000) });

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const { imageIds } = await parseBody(request, downloadSchema);
    const { filename, size, body } = await zipImages(imageIds);
    return attachmentResponse(body, filename, 'application/zip', {
        'Content-Length': String(size)
    });
});
