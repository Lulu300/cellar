import type { RequestHandler } from './$types';
import { getStatistics } from '#lib/server/features/bottles/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(async () => Response.json(await getStatistics()));
