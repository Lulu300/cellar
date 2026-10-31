import type { RequestHandler } from './$types';
import { getSettings, saveSettings } from '#lib/server/features/settings/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { settingsRequest } from '#lib/server/http/request-schemas.js';

export const GET: RequestHandler = apiHandler(() => Response.json(getSettings()));

// Only for authenticated users (hooks.server.ts)
export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    saveSettings(await parseBody(request, settingsRequest));
    return Response.json(getSettings());
});
