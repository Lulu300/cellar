import type { RequestHandler } from './$types';
import { manualBackupRequest } from '#lib/server/features/backup/files.js';
import { createManualExport } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const body = await parseBody(request, manualBackupRequest);
    const { file, recordCount, restorable } = await createManualExport(body?.name);
    return Response.json(
        {
            success: true,
            message: 'Full export with JSON and images created successfully',
            files: { zip: file },
            recordCount,
            restorable
        },
        { status: 201 }
    );
});
