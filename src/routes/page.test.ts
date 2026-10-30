import { isRedirect } from '@sveltejs/kit';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { load } from './+page';

const environment = vi.hoisted(() => ({ browser: false }));
vi.mock('$app/env', () => ({
    get browser() {
        return environment.browser;
    }
}));

const loadPage = () => load({} as Parameters<typeof load>[0]);

beforeEach(() => {
    environment.browser = false;
});

describe('the page at /', () => {
    // The healthcheck of the Dockerfile, and that of docker-compose.yml files copied before 0.11.0,
    // expect / to answer 200.
    it('answers on the server with a page that leads to /wines without JavaScript', () => {
        expect(loadPage()).toBeUndefined();

        const { head, body } = render(Page);
        expect(head).toContain('<meta http-equiv="refresh" content="0; url=/wines"');
        expect(body).toContain('href="/wines"');
    });

    it('redirects to /wines in the browser, as on a client-side navigation', () => {
        environment.browser = true;

        let thrown: unknown;
        try {
            loadPage();
        } catch (error) {
            thrown = error;
        }
        expect(isRedirect(thrown) && thrown.location).toBe('/wines');
    });
});
