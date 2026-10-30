import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { Session } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../test/event';
import { load as layoutLoad } from './+layout.server';
import { load } from './+page.server';

type Event = Parameters<typeof load>[0];

/** The page load as SvelteKit runs it, under the layout that guards it. */
function loadPage(session: Session | null) {
    const event = fakeEvent<Event>({ path: '/barcode', routeId: '/barcode', session });
    return load({
        ...event,
        parent: async () => layoutLoad(event as never) ?? {},
        depends: () => {}
    } as Event);
}

describe('the load of /barcode', () => {
    // The settings and the presets come from the admin API, which needs a session.
    it('sends a visitor without a session to the login before loading anything', async () => {
        const failure = await Promise.resolve(loadPage(null)).catch((error: unknown) => error);

        expect(isRedirect(failure) && failure.location).toBe('/wines?login');
    });

    it('loads the settings, the counts and the presets with a session', async () => {
        const data = await loadPage({ tokenHash: 'hash', expiresAt: new Date() });

        expect(data).toMatchObject({
            barcodeSettings: { autoGeneration: expect.any(Boolean) },
            barcodeStats: { totalWithBarcode: 0 },
            manualBarcodeStats: { totalWithBarcode: 0 },
            labelPresets: expect.any(Array)
        });
    });
});
