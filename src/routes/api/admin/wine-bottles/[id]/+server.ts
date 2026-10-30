import type { RequestHandler } from './$types';
import { deleteWineBottle } from '#lib/server/features/bottles/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

// The same as DELETE /api/bottles/{id}, kept for the scripts that call it: 404 for an unknown bottle
export const DELETE: RequestHandler = apiHandler(({ params }) => {
    deleteWineBottle(params.id);
    return new Response(null, { status: 204 });
});
