import type { RequestHandler } from './$types';
import { uploadImage } from '#lib/server/features/images/service.js';
import { parseFormData } from '#lib/server/http/body.js';
import { invalidField, tooLargeError } from '#lib/server/http/errors.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { MAX_WINE_IMAGE_BYTES } from '#lib/shared/images.js';

export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const imageFile = (await parseFormData(request, MAX_WINE_IMAGE_BYTES)).get('image');
    if (!(imageFile instanceof File)) {
        throw invalidField('image', 'No image file provided');
    }
    if (imageFile.size > MAX_WINE_IMAGE_BYTES) throw tooLargeError();
    return Response.json(await uploadImage(imageFile), { status: 201 });
});
