import { occupancy } from '#lib/server/features/storage/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

// { [caseId]: number of available bottles }
export const GET: RequestHandler = apiHandler(() => Response.json(occupancy()));
