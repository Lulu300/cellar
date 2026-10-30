import { listBottlesForAdmin } from '#lib/server/features/bottles/service.js';
import { wineFormatHandlers } from '#lib/server/features/catalog/service.js';
import { redirectWithoutSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
    // Not only the layout's: SvelteKit can run a page load without it.
    redirectWithoutSession(locals);
    return { items: listBottlesForAdmin(), formats: wineFormatHandlers.list() };
};
