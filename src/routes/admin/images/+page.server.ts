import { listImagesWithStats } from '#lib/server/features/images/service.js';
import { redirectWithoutSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // Not only the layout's: SvelteKit can run a page load without it.
    redirectWithoutSession(locals);
    return { images: await listImagesWithStats() };
};
