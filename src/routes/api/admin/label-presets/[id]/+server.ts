import {
    deleteLabelPreset,
    getLabelPreset,
    updateLabelPreset
} from '#lib/server/features/labels/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { labelPresetSchema } from '#lib/shared/schemas/label.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(({ params }) =>
    Response.json(getLabelPreset(params.id))
);

// Replaces every field; 409 for a name that another preset has. An unknown id answers 404 before
// the body is read, whatever it holds.
export const PUT: RequestHandler = apiHandler(async ({ params, request }) => {
    getLabelPreset(params.id);
    return Response.json(updateLabelPreset(params.id, await parseBody(request, labelPresetSchema)));
});

export const DELETE: RequestHandler = apiHandler(({ params }) => {
    deleteLabelPreset(params.id);
    return new Response(null, { status: 204 });
});
