import { browser } from '$app/env';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The server renders the page, which leads to /wines by itself, because the healthcheck of the
// Dockerfile, and that of docker-compose.yml files copied before 0.11.0, expect / to answer 200. A
// client-side navigation to / never shows that page: the browser redirects here.
export const load: PageLoad = () => {
    if (browser) redirect(307, '/wines');
};
