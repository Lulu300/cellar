import { createLabelPreset, listPresets } from '#lib/server/features/labels/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { labelPresetSchema } from '#lib/shared/schemas/label.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(() => Response.json(listPresets()));

// 409 for a name that another preset has
export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const preset = createLabelPreset(await parseBody(request, labelPresetSchema));
    return Response.json(preset, { status: 201 });
});
