import type { RequestHandler } from './$types';
import { createWish, listWishes } from '#lib/server/features/wishlist/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { wishSchema } from '#lib/shared/schemas/wish.js';

export const GET: RequestHandler = apiHandler(() => Response.json(listWishes()));

// 409 duplicate_wish when the wine is on the wishlist already
export const POST: RequestHandler = apiHandler(async ({ request }) =>
    Response.json(createWish(await parseBody(request, wishSchema)), { status: 201 })
);
