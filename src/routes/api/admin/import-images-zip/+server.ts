import type { RequestHandler } from './$types';
import { importImagesZip } from '#lib/server/features/images/service.js';
import { parseFormData } from '#lib/server/http/body.js';
import { invalidField } from '#lib/server/http/errors.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { MAX_ZIP_UPLOAD_BYTES } from '#lib/server/zip.js';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const zipFile = (await parseFormData(request, MAX_ZIP_UPLOAD_BYTES)).get('zipFile');
    if (!(zipFile instanceof File)) throw invalidField('zipFile', 'No ZIP file provided');
    return Response.json(await importImagesZip(zipFile), { status: 201 });
});
