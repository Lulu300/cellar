import { z } from 'zod';
import type { RequestHandler } from './$types';
import { EXPORT_TABLES, type ExportTableName } from '#lib/server/features/backup/export.js';
import { exportCsvTables } from '#lib/server/features/backup/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';

const exportSchema = z.object({
    tables: z
        .array(
            z
                .string()
                .refine(
                    (table): table is ExportTableName => Object.hasOwn(EXPORT_TABLES, table),
                    'Unknown table'
                )
        )
        .min(1),
    customName: z.string().optional(),
    delimiter: z.string().min(1).max(5).default(',')
});

// The files are in the answer: nothing is written on the server.
export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const exported = exportCsvTables(await parseBody(request, exportSchema));
    return Response.json({
        success: true,
        message: `CSV export completed successfully`,
        ...exported
    });
});
