import type { RequestHandler } from './$types';
import { listImageUrls } from '#lib/server/features/images/service.js';
import { apiHandler } from '#lib/server/http/handler.js';

// For scripts: the id and URL of each image, public like the other reads. The pages read the URLs
// on the server instead (imageUrlsById), and GET /api/admin/images, which also exposes file sizes
// and dates, needs a session.
export const GET: RequestHandler = apiHandler(() => Response.json({ images: listImageUrls() }));
