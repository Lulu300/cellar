import { attachmentResponse } from '#lib/server/content-disposition.js';
import { exportBarcodes } from '#lib/server/features/barcode/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

// The bottles with a code of the configured prefix
export const GET: RequestHandler = apiHandler(() => {
    const { filename, csv } = exportBarcodes();
    return attachmentResponse(csv, filename, 'text/csv');
});
