import { listCaseBottles } from '#lib/server/features/bottles/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(({ params }) =>
    Response.json(listCaseBottles(params.id))
);
