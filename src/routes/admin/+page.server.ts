import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The admin has no page of its own: it opens on its first section.
export const load: PageServerLoad = () => redirect(307, '/admin/settings');
