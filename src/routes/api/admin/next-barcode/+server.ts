import type { RequestHandler } from './$types';
import { nextBarcode } from '#lib/server/features/barcode/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

// 409 while barcodes are not automatic, once the prefix has no number left, or for an old prefix
// longer than 6 characters
export const GET: RequestHandler = apiHandler(() => Response.json(nextBarcode()));
