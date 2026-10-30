import type { RequestHandler } from './$types';
import { backupFileRequest } from '#lib/server/features/backup/files.js';
import { deleteBackup } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const DELETE: RequestHandler = apiHandler(async ({ request }) => {
    const { filename } = await parseBody(request, backupFileRequest);
    await deleteBackup(filename);
    return new Response(null, { status: 204 });
});
