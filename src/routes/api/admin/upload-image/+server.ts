import type { RequestHandler } from './$types';
import { uploadImages } from '#lib/server/features/images/service.js';
import { parseFormData } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { MAX_ZIP_UPLOAD_BYTES } from '#lib/server/zip.js';

// The admin page sends a whole selection of images in one request, so it gets the same memory
// budget as a zip upload.
export const POST: RequestHandler = apiHandler(async ({ request }) => {
    const form = await parseFormData(request, MAX_ZIP_UPLOAD_BYTES);
    // One image in `image`, or several in `images`
    const single = form.get('image');
    const files = single instanceof File ? [single] : form.getAll('images');
    const uploaded = await uploadImages(files.filter((file) => file instanceof File));
    return Response.json(uploaded, { status: 201 });
});
