import type { RequestHandler } from './$types';
import { createBackupToken } from '#lib/server/features/backup/token.js';
import { apiHandler } from '#lib/server/http/handler.js';

/** Creates the token of the cron job, replacing the earlier one, and returns it this once. */
export const POST: RequestHandler = apiHandler(() => Response.json({ token: createBackupToken() }));
