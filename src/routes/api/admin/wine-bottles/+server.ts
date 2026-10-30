import type { RequestHandler } from './$types';
import { listBottlesForAdmin } from '#lib/server/features/bottles/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(() => Response.json(listBottlesForAdmin()));
