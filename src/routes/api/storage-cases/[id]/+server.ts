import { deleteStorageCase } from '#lib/server/features/storage/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

// 409 (CaseHoldsBottlesError) while the case holds an available bottle
export const DELETE: RequestHandler = apiHandler(({ params }) => {
    deleteStorageCase(params.id);
    return new Response(null, { status: 204 });
});
