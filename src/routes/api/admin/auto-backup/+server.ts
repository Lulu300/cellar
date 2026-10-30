import type { RequestHandler } from './$types';
import { runCronBackup } from '#lib/server/features/backup/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

// The cron job's route: hooks.server.ts lets it in with the backup token, as well as with a session.
export const POST: RequestHandler = apiHandler(async () => {
    const { files, timestamp } = await runCronBackup();
    return Response.json({
        success: true,
        message: 'Automatic backup and export completed successfully',
        files,
        timestamp
    });
});
