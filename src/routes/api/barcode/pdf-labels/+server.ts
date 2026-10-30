import { attachmentResponse } from '#lib/server/content-disposition.js';
import { generateLabelsPdf } from '#lib/server/features/labels/pdf.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { labelSheetSchema } from '#lib/shared/schemas/label.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const { filename, pdf } = generateLabelsPdf(await parseBody(request, labelSheetSchema));
    return attachmentResponse(new Uint8Array(pdf), filename, 'application/pdf');
});
