import { attachmentResponse } from '#lib/server/content-disposition.js';
import { exportBarcodeRange } from '#lib/server/features/barcode/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { labelRangeSchema } from '#lib/shared/schemas/label.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const { startNumber, count, prefix } = await parseBody(request, labelRangeSchema);
    const { filename, csv } = exportBarcodeRange(startNumber, count, prefix);
    return attachmentResponse(csv, filename, 'text/csv');
});
