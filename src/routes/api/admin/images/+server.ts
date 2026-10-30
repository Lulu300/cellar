import { z } from 'zod';
import type { RequestHandler } from './$types';
import {
    deleteImages,
    listImagesWithStats,
    renameImage
} from '#lib/server/features/images/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

// GET - List all images, newest first
export const GET: RequestHandler = apiHandler(async () => {
    const images = await listImagesWithStats();
    return Response.json({ images, count: images.length });
});

const renameRequest = z.object({ imageId: z.string().min(1), newFilename: z.string().min(1) });

export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    const { imageId, newFilename } = await parseBody(request, renameRequest);
    return Response.json(await renameImage(imageId, newFilename));
});

const deleteRequest = z.object({
    imageIds: z.array(z.string().min(1)).min(1),
    force: z.boolean().default(false)
});

// 409 in_use, with the wines that use them, unless `force` removes them from those wines
export const DELETE: RequestHandler = apiHandler(async ({ request }) => {
    const { imageIds, force } = await parseBody(request, deleteRequest);
    await deleteImages(imageIds, force);
    return new Response(null, { status: 204 });
});
