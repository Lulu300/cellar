import { z } from 'zod';
import type { RequestHandler } from './$types';
import { BACKUP_MODES, INTERVAL_HOURS, KEEP_COUNT } from '#lib/server/features/backup/scheduler.js';
import { getBackupSettingsView, saveBackupSettings } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(() => Response.json(getBackupSettingsView()));

const range = ({ min, max }: { min: number; max: number }) => z.int().min(min).max(max);

const backupSettingsSchema = z.object({
    autoBackupEnabled: z.boolean(),
    autoBackupInterval: range(INTERVAL_HOURS),
    autoBackupKeepCount: range(KEEP_COUNT),
    // Optional: a request without it keeps the stored mode.
    autoBackupMode: z.enum(BACKUP_MODES).optional()
});

export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    saveBackupSettings(await parseBody(request, backupSettingsSchema));
    return Response.json(getBackupSettingsView());
});
