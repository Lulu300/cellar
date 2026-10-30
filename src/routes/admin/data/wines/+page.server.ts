import { listDefinitionsForAdmin } from '#lib/server/features/catalog/service.js';
import { appellationHandlers } from '#lib/server/features/geography/service.js';
import { redirectWithoutSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
    // Not only the layout's: SvelteKit can run a page load without it.
    redirectWithoutSession(locals);
    // The other filters take their lists from the root layout.
    return { items: listDefinitionsForAdmin(), appellations: appellationHandlers.list() };
};
