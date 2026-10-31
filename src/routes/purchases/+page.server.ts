import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The purchases have no page of their own: they open on their first tab.
export const load: PageServerLoad = () => redirect(307, '/purchases/wishlist');
