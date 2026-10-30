import { manualBarcodeStats } from '#lib/server/features/barcode/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(() => Response.json(manualBarcodeStats()));
