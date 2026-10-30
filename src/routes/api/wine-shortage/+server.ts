import type { RequestHandler } from './$types';
import { getWineShortages } from '#lib/server/features/bottles/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(async () => Response.json(await getWineShortages()));
