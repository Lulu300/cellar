import type { RequestHandler } from './$types';
import { attachmentResponse } from '#lib/server/content-disposition.js';
import { openBackupFile } from '#lib/server/features/backup/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

// The file by its `filename`, as the other backup routes name it.
export const GET: RequestHandler = apiHandler(async ({ url }) => {
    const { body, filename, contentType, size } = await openBackupFile(
        url.searchParams.get('filename') ?? ''
    );
    return attachmentResponse(body, filename, contentType, { 'Content-Length': String(size) });
});
