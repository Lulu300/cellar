import type { RequestHandler } from './$types';
import { deleteDefinitionAndBottles } from '#lib/server/features/catalog/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

// With its bottles when `cascade=true`; otherwise 409 in_use, with their count, while it has some
export const DELETE: RequestHandler = apiHandler(({ params, url }) => {
    deleteDefinitionAndBottles(params.id, url.searchParams.get('cascade') === 'true');
    return new Response(null, { status: 204 });
});
