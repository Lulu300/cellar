import { z } from 'zod';
import { parseBody } from '#lib/server/http/body.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { setUpgradeActionDone } from '#lib/server/upgrade.js';
import type { RequestHandler } from './$types';

const tickSchema = z.object({ version: z.string(), index: z.int(), done: z.boolean() });

/** Ticks or unticks an upgrade action of the admin banner: { version, index, done }. */
export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    const { version, index, done } = await parseBody(request, tickSchema);
    const action = setUpgradeActionDone(version, index, done);
    if (!action) throw new NotFoundError('No such upgrade action');
    return Response.json(action);
});
