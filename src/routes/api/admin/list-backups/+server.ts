import type { RequestHandler } from './$types';
import { listBackups } from '#lib/server/features/backup/files.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(async () => {
    return Response.json({ backups: await listBackups() });
});
