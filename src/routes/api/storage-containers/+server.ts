import { createContainer, listContainers } from '#lib/server/features/storage/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { newContainerSchema } from '#lib/shared/schemas/storage.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(() => Response.json(listContainers()));

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const created = createContainer(await parseBody(request, newContainerSchema));
    return Response.json(created, { status: 201 });
});
