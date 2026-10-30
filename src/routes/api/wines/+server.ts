import type { RequestHandler } from './$types';
import { listWines } from '#lib/server/features/catalog/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

export const GET: RequestHandler = apiHandler(() => Response.json(listWines()));
