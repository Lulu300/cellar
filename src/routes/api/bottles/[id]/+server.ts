import type { RequestHandler } from './$types';
import { deleteWineBottle, updateWineBottle } from '#lib/server/features/bottles/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { bottleChangesSchema } from '#lib/shared/schemas/bottle.js';

// 409 (CaseFullError) when it would put one more available bottle in a full case
export const PATCH: RequestHandler = apiHandler(async ({ params, request }) =>
    Response.json(updateWineBottle(params.id, await parseBody(request, bottleChangesSchema)))
);

export const DELETE: RequestHandler = apiHandler(({ params }) => {
    deleteWineBottle(params.id);
    return new Response(null, { status: 204 });
});
