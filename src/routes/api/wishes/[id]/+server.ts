import type { RequestHandler } from './$types';
import { removeWish, replaceWish } from '#lib/server/features/wishlist/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { wishSchema } from '#lib/shared/schemas/wish.js';

export const PUT: RequestHandler = apiHandler(async ({ params, request }) =>
    Response.json(await replaceWish(params.id, await parseBody(request, wishSchema)))
);

export const DELETE: RequestHandler = apiHandler(async ({ params }) => {
    await removeWish(params.id);
    return new Response(null, { status: 204 });
});
