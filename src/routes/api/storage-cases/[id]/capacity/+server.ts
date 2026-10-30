import { caseCapacity } from '#lib/server/features/storage/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(({ params }) =>
    Response.json(caseCapacity(params.id))
);
