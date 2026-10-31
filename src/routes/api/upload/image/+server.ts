import type { RequestHandler } from './$types';
import { uploadImage } from '#lib/server/features/images/service.js';
import { parseImageForm } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const POST: RequestHandler = apiHandler(async ({ request }) =>
    Response.json(await uploadImage(await parseImageForm(request)), { status: 201 })
);
