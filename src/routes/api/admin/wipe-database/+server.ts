import type { RequestHandler } from './$types';
import { wipeDatabase } from '#lib/server/features/backup/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const POST: RequestHandler = apiHandler(async () => Response.json(await wipeDatabase()));
