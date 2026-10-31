import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_CODE_KEY, hashAccessCode } from '#lib/server/access-code.js';
import { db } from '#lib/server/db/index.js';
import { appSettings } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { fakeEvent } from '../test/event';
import { insertBottles, insertWineDefinition } from '../test/wine';
import { load } from './+layout.server';

const loadLayout = (session: { tokenHash: string; expiresAt: Date } | null) =>
    load({
        ...fakeEvent<RequestEvent>({ session, routeId: '/wines' }),
        depends: () => {}
    } as never) as Promise<{
        authenticated: boolean;
        accessCodeSet: boolean;
        outOfCellarCount: number;
    }>;

beforeEach(() => {
    db.delete(appSettings).run();
});

// The first render, on the server, shows the menu and the buttons of the request's session: the
// Admin link for a logged-in visitor, the login button otherwise (UI-17).
describe('the root layout load', () => {
    it('tells the pages whether the request has a session', async () => {
        const session = { tokenHash: 'hash', expiresAt: new Date() };

        expect(await loadLayout(session)).toMatchObject({ authenticated: true });
        expect(await loadLayout(null)).toMatchObject({ authenticated: false });
    });

    it('tells whether an access code is set, for the login dialog to ask for the first one', async () => {
        expect(await loadLayout(null)).toMatchObject({ accessCodeSet: false });

        setAppSetting(ACCESS_CODE_KEY, await hashAccessCode('4821'));

        expect(await loadLayout(null)).toMatchObject({ accessCodeSet: true });
    });

    it('counts the bottles out of the cellar, for the menu and the wine list', async () => {
        const { AVAILABLE, OUT_OF_CELLAR, CONSUMED } = BottleAvailability;
        await insertBottles(await insertWineDefinition(), [
            { availability: AVAILABLE },
            { availability: OUT_OF_CELLAR },
            { availability: OUT_OF_CELLAR },
            { availability: CONSUMED }
        ]);

        expect(await loadLayout(null)).toMatchObject({ outOfCellarCount: 2 });
    });
});
