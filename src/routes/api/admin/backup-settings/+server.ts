import type { RequestHandler } from './$types';
import { getBackupSettingsView, saveBackupSettings } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { backupSettingsRequest } from '#lib/server/http/request-schemas.js';

export const GET: RequestHandler = apiHandler(() => Response.json(getBackupSettingsView()));

export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    saveBackupSettings(await parseBody(request, backupSettingsRequest));
    return Response.json(getBackupSettingsView());
});
