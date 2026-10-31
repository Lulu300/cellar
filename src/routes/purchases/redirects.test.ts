import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { fakeEvent } from '../../test/event';
import { load as purchases } from './+page.server';
import { load as wineShortage } from '../wine-shortage/+page.server';

/** Where a page load sends the browser, and with which status. */
function redirectOf(load: (event: never) => unknown, path: string) {
    try {
        load(fakeEvent({ path }) as never);
    } catch (error) {
        if (isRedirect(error)) return { status: error.status, location: error.location };
    }
    throw new Error(`${path} did not redirect`);
}

describe('the addresses of the purchases', () => {
    // The shortage page was /wine-shortage until it became a tab of the purchases (UI-28).
    it('sends the old address of the shortage to its tab, for good, with its query', () => {
        expect(redirectOf(wineShortage, '/wine-shortage?from=bookmark')).toEqual({
            status: 308,
            location: '/purchases/shortage?from=bookmark'
        });
    });

    it('opens the purchases on their first tab', () => {
        expect(redirectOf(purchases, '/purchases')).toEqual({
            status: 307,
            location: '/purchases/wishlist'
        });
    });
});
