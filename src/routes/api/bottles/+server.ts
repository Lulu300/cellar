import type { RequestHandler } from './$types';
import {
    createBottles,
    listBottlesWithDefinitions,
    updateBottles
} from '#lib/server/features/bottles/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { bulkBottleChangesSchema, newBottlesSchema } from '#lib/shared/schemas/bottle.js';

export const GET: RequestHandler = apiHandler(() => Response.json(listBottlesWithDefinitions()));

// 409 (CaseFullError) when the case has no room for them
export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const { quantity, ...bottle } = await parseBody(request, newBottlesSchema);
    const bottles = createBottles(bottle, quantity);
    return Response.json({ bottles, count: bottles.length }, { status: 201 });
});

// All or nothing: 404 naming the bottles that do not exist, 409 (CaseFullError) when a case has
// no room for them.
export const PATCH: RequestHandler = apiHandler(async ({ request }) => {
    const { ids, changes, addedNote } = await parseBody(request, bulkBottleChangesSchema);
    return Response.json({ bottles: updateBottles(ids, changes, addedNote) });
});
