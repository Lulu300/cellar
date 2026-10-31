import { z } from 'zod';
import type { RequestHandler } from './$types';
import { getSettings, saveSettings } from '#lib/server/features/settings/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import {
    isValidSessionTimeout,
    MAX_SESSION_TIMEOUT_HOURS,
    MIN_SESSION_TIMEOUT_HOURS
} from '#lib/shared/session-timeout.js';

const settingsSchema = z.object({
    sessionTimeoutHours: z.custom<number>(
        isValidSessionTimeout,
        `Session timeout must be a whole number of hours between ${MIN_SESSION_TIMEOUT_HOURS} and ${MAX_SESSION_TIMEOUT_HOURS}`
    )
});

export const GET: RequestHandler = apiHandler(() => Response.json(getSettings()));

// Only for authenticated users (hooks.server.ts)
export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    saveSettings(await parseBody(request, settingsSchema));
    return Response.json(getSettings());
});
