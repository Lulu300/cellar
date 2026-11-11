import type { RequestHandler } from './$types';
import {
    csvImportForm,
    importCsv,
    MAX_CSV_UPLOAD_BYTES
} from '#lib/server/features/csv-import/service.js';
import { parseFormData, parseWith } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const form = await parseFormData(request, MAX_CSV_UPLOAD_BYTES);
    const field = (name: string) => form.get(name) ?? undefined;
    const input = parseWith(csvImportForm, {
        files: form.getAll('files'),
        delimiter: field('delimiter'),
        overrideAllBarcodes: field('overrideAllBarcodes'),
        dryRun: field('dryRun'),
        choices: field('choices')
    });
    return Response.json(await importCsv(input));
});
