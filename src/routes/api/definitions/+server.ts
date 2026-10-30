import type { RequestHandler } from './$types';
import { createDefinition, listDefinitions } from '#lib/server/features/catalog/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { wineDefinitionSchema } from '#lib/shared/schemas/wine.js';

export const GET: RequestHandler = apiHandler(() => Response.json(listDefinitions()));

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const definition = createDefinition(await parseBody(request, wineDefinitionSchema));
    return Response.json(definition, { status: 201 });
});
