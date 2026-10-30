import type { RequestHandler } from './$types';
import { manualBackupRequest } from '#lib/server/features/backup/files.js';
import { createManualBackup } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const body = await parseBody(request, manualBackupRequest);
    const file = await createManualBackup(body?.name);
    return Response.json(
        {
            success: true,
            message: 'Database backup with images created successfully',
            ...file
        },
        { status: 201 }
    );
});
