import type { RequestHandler } from './$types';
import {
    deleteImages,
    listImagesWithStats,
    renameImage
} from '#lib/server/features/images/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { imageRenameRequest, imagesDeleteRequest } from '#lib/server/http/request-schemas.js';

// GET - List all images, newest first
export const GET: RequestHandler = apiHandler(async () => {
    const images = await listImagesWithStats();
    return Response.json({ images, count: images.length });
});

export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    const { imageId, newFilename } = await parseBody(request, imageRenameRequest);
    return Response.json(await renameImage(imageId, newFilename));
});

// 409 in_use, with the wines that use them, unless `force` removes them from those wines
export const DELETE: RequestHandler = apiHandler(async ({ request }) => {
    const { imageIds, force } = await parseBody(request, imagesDeleteRequest);
    await deleteImages(imageIds, force);
    return new Response(null, { status: 204 });
});
