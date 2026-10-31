import type { RequestHandler } from './$types';
import { chooseMainPhoto } from '#lib/server/features/images/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { mainPhotoRequest } from '#lib/server/http/request-schemas.js';

export const PUT: RequestHandler = apiHandler(async ({ params, request }) => {
    const { imageId } = await parseBody(request, mainPhotoRequest);
    return Response.json({ photos: chooseMainPhoto(params.id, imageId) });
});
