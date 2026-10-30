import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { Session } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../test/event';
import { load as backups } from './backups/+page.server';
import { load as bottles } from './data/bottles/+page.server';
import { load as reference } from './data/[entity]/+page.server';
import { load as wines } from './data/wines/+page.server';
import { load as images } from './images/+page.server';
import { load as settings } from './settings/+page.server';

type AnyLoad = (event: never) => unknown;

const PAGES: [string, AnyLoad, Record<string, string>][] = [
    ['/admin/settings', settings, {}],
    ['/admin/backups', backups, {}],
    ['/admin/images', images, {}],
    ['/admin/data/wines', wines, {}],
    ['/admin/data/bottles', bottles, {}],
    ['/admin/data/[entity]', reference, { entity: 'countries' }]
];

/** The page load alone, as SvelteKit may run it when only the page's data is stale. */
function loadPage(
    load: AnyLoad,
    routeId: string,
    params: Record<string, string>,
    session: Session | null
) {
    const event = fakeEvent({ path: routeId, routeId, params, session });
    return Promise.resolve().then(() => load(event as never));
}

describe('the loads of the admin pages', () => {
    // SvelteKit may run a page load without its layout's (`__data.json?x-sveltekit-invalidated=001`),
    // so each one checks the session itself before reading anything.
    it.each(PAGES)(
        '%s sends a visitor without a session to the login',
        async (routeId, load, params) => {
            const failure = await loadPage(load, routeId, params, null).catch(
                (error: unknown) => error
            );

            expect(isRedirect(failure) && failure.location).toBe('/wines?login');
        }
    );

    it.each(PAGES)('%s loads its data with a session', async (routeId, load, params) => {
        const session = { tokenHash: 'hash', expiresAt: new Date() };

        expect(await loadPage(load, routeId, params, session)).toBeTypeOf('object');
    });

    it('answers 404 for a table the admin does not edit', async () => {
        const session = { tokenHash: 'hash', expiresAt: new Date() };
        const failure = await loadPage(
            reference,
            '/admin/data/[entity]',
            { entity: 'sessions' },
            session
        ).catch((error: unknown) => error);

        expect(failure).toMatchObject({ status: 404 });
    });
});
