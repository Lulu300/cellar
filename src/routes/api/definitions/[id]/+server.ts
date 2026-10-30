import type { RequestHandler } from './$types';
import {
    deleteDefinitionAndBottles,
    getDefinitionDetails,
    replaceDefinition
} from '#lib/server/features/catalog/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { wineDefinitionSchema } from '#lib/shared/schemas/wine.js';

export const GET: RequestHandler = apiHandler(({ params }) =>
    Response.json(getDefinitionDetails(params.id))
);

export const PUT: RequestHandler = apiHandler(async ({ params, request }) =>
    Response.json(replaceDefinition(params.id, await parseBody(request, wineDefinitionSchema)))
);

// 409 in_use, with their count, while bottles use it
export const DELETE: RequestHandler = apiHandler(({ params }) => {
    deleteDefinitionAndBottles(params.id, false);
    return new Response(null, { status: 204 });
});
