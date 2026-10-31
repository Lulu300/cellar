import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The shortage moved to a tab of the purchases (UI-28): links and bookmarks still lead there.
export const load: PageServerLoad = ({ url }) => redirect(308, `/purchases/shortage${url.search}`);
