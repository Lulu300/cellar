import type { RequestHandler } from './$types';
import { importJson } from '#lib/server/features/backup/json-import.js';
import { parseZipRequest } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { MAX_ZIP_UPLOAD_BYTES } from '#lib/server/zip.js';

// hooks.server.ts lets it in without the write gate: it holds the other writes itself.
export const POST: RequestHandler = apiHandler(async ({ request }) => {
    return Response.json(await importJson(await parseZipRequest(request, MAX_ZIP_UPLOAD_BYTES)));
});
