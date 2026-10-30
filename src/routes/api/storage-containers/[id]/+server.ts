import { deleteContainer, updateContainer } from '#lib/server/features/storage/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { containerSchema } from '#lib/shared/schemas/storage.js';
import type { RequestHandler } from './$types';

// The body lists every case of the container, in order: a case it leaves out is deleted. 409
// (CaseFullError) for a capacity below the available bottles of its case, 409
// (CaseHoldsBottlesError) for a case to delete that holds one, 404 for a case of another container.
export const PUT: RequestHandler = apiHandler(async ({ request, params }) =>
    Response.json(updateContainer(params.id, await parseBody(request, containerSchema)))
);

// With its cases; 409 (CaseHoldsBottlesError) while one of them holds an available bottle
export const DELETE: RequestHandler = apiHandler(({ params }) => {
    deleteContainer(params.id);
    return new Response(null, { status: 204 });
});
