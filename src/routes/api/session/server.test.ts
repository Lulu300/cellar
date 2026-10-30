import { describe, expect, it } from 'vitest';
import { createSession, getSession } from '#lib/server/session.js';
import { fakeCookies, fakeEvent } from '../../../test/event';
import { DELETE, GET } from './+server';

type Event = Parameters<typeof GET>[0];

const LOCALHOST = new URL('http://localhost');

describe('/api/session', () => {
    it('reports whether the request has a session', async () => {
        const session = await createSession(fakeCookies(), LOCALHOST);

        expect(await (await GET(fakeEvent<Event>({ session }))).json()).toEqual({
            authenticated: true
        });
        expect(await (await GET(fakeEvent<Event>())).json()).toEqual({ authenticated: false });
    });

    it('logs out: the session ends on the server and its cookie is cleared', async () => {
        const cookies = fakeCookies();
        const session = await createSession(cookies, LOCALHOST);
        const token = cookies.get('cellar_session')!;

        const response = await DELETE(fakeEvent<Event>({ method: 'DELETE', cookies, session }));

        expect(response.status).toBe(204);
        expect(cookies.get('cellar_session')).toBeUndefined();
        // A copy of the cookie, kept from before the logout, no longer works either.
        const copiedCookies = fakeCookies();
        copiedCookies.set('cellar_session', token, { path: '/' });
        expect(await getSession(copiedCookies)).toBeNull();
    });
});
