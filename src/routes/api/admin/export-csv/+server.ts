import type { RequestHandler } from './$types';
import { exportCsvTables } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { csvExportRequest } from '#lib/server/http/request-schemas.js';

// The files are in the answer: nothing is written on the server.
export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const exported = exportCsvTables(await parseBody(request, csvExportRequest));
    return Response.json({
        success: true,
        message: `CSV export completed successfully`,
        ...exported
    });
});
