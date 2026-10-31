import type { RequestHandler } from './$types';
import { removeWinePhoto } from '#lib/server/features/images/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const DELETE: RequestHandler = apiHandler(async ({ params }) => {
    await removeWinePhoto(params.id, params.imageId);
    return new Response(null, { status: 204 });
});
