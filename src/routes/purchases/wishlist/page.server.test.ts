import type { RequestEvent } from '@sveltejs/kit';
import { beforeAll, describe, expect, it } from 'vitest';
import { fakeEvent } from '../../../test/event';
import { insertWineDefinition } from '../../../test/wine';
import { load } from './+page.server';

const loadPage = (session: { tokenHash: string; expiresAt: Date } | null) =>
    load({
        ...fakeEvent<RequestEvent>({ session, routeId: '/purchases/wishlist' }),
        depends: () => {}
    } as never) as { wines: { id: string; name: string }[] };

beforeAll(insertWineDefinition);

describe('the wishlist page load', () => {
    // The field that suggests the wines needs a session, as every write does.
    it('gives the wines to suggest only with a session', () => {
        const session = { tokenHash: 'hash', expiresAt: new Date() };

        expect(loadPage(session).wines).toEqual([
            { id: 'margaux', name: 'Château Margaux', producer: null }
        ]);
        expect(loadPage(null).wines).toEqual([]);
    });
});
