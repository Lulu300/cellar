import type { RequestHandler } from './$types';
import { apiHandler } from '#lib/server/http/handler.js';
import { destroySession } from '#lib/server/session.js';

export const GET: RequestHandler = apiHandler(({ locals }) =>
    Response.json({ authenticated: locals.session !== null })
);

// Logout. hooks.server.ts answers 401 before this runs when there is no session.
export const DELETE: RequestHandler = apiHandler(async ({ locals, cookies, url }) => {
    await destroySession(cookies, url, locals.session!);
    return new Response(null, { status: 204 });
});
