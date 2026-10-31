import type { RequestHandler } from './$types';
import { getBarcodeSettings, updateBarcodeSettings } from '#lib/server/features/barcode/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { barcodeSettingsRequest } from '#lib/server/http/request-schemas.js';

export const GET: RequestHandler = apiHandler(() => Response.json(getBarcodeSettings()));

// The settings as saved, with `conflictInfo`: where the codes go on from, when it is not the start
// number asked for.
export const PUT: RequestHandler = apiHandler(async ({ request }) => {
    const conflictInfo = updateBarcodeSettings(await parseBody(request, barcodeSettingsRequest));
    return Response.json({ ...getBarcodeSettings(), conflictInfo });
});
