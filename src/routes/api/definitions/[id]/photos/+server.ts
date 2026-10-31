import type { RequestHandler } from './$types';
import { addWinePhoto, listWinePhotos } from '#lib/server/features/images/service.js';
import { parseImageForm } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(({ params }) =>
    Response.json({ photos: listWinePhotos(params.id) })
);

export const POST: RequestHandler = apiHandler(async ({ params, request }) => {
    const photos = await addWinePhoto(params.id, await parseImageForm(request));
    return Response.json({ photos }, { status: 201 });
});
