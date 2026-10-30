import type { RequestHandler } from './$types';
import { restoreBackup } from '#lib/server/features/backup/service.js';
import { parseZipRequest } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { MAX_ZIP_UPLOAD_BYTES } from '#lib/server/zip.js';

// hooks.server.ts lets it in without the write gate: it holds the other writes itself.
export const POST: RequestHandler = apiHandler(async ({ request, locals }) => {
    const source = await parseZipRequest(request, MAX_ZIP_UPLOAD_BYTES);
    // Never null: hooks.server.ts answers 401 to any /api/admin request without a session.
    return Response.json(await restoreBackup(source, locals.session!));
});
