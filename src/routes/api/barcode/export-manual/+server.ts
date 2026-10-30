import { attachmentResponse } from '#lib/server/content-disposition.js';
import { exportManualBarcodes } from '#lib/server/features/barcode/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

// Every bottle with a barcode, whatever its prefix
export const GET: RequestHandler = apiHandler(() => {
    const { filename, csv } = exportManualBarcodes();
    return attachmentResponse(csv, filename, 'text/csv');
});
