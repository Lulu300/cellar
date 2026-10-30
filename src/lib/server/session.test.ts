import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, sessions } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { elapse, HOUR } from '../../test/clock';
import { fakeCookies, fakeEvent } from '../../test/event';
import {
    authenticate,
    createSession,
    destroySession,
    getSession,
    keepOnlySession,
    requiresSession,
    SESSION_TIMEOUT_KEY
} from './session';

const START = new Date('2026-10-10T12:00:00Z');
const HTTP_URL = new URL('http://cellar.lan');

const setSessionTimeout = (value: string) => setAppSetting(SESSION_TIMEOUT_KEY, value);

describe('requiresSession', () => {
    it.each([
        ['GET', '/api/wines', false],
        ['HEAD', '/api/wines', false],
        ['OPTIONS', '/api/wines', false],
        ['GET', '/wines/[id]', false],
        ['POST', '/api/definitions', true],
        ['PUT', '/api/definitions/[id]', true],
        ['PATCH', '/api/bottles/[id]', true],
        ['DELETE', '/api/storage-cases/[id]', true],
        ['POST', '/admin', true],
        ['GET', '/api/admin/list-backups', true],
        ['GET', '/api/admin/download-backup', true],
        ['GET', '/api/admin/export-csv', true],
        ['POST', '/api/admin/wipe-database', true],
        ['GET', '/api/access-code', false],
        ['POST', '/api/access-code', false],
        ['PUT', '/api/access-code', true],
        ['DELETE', '/api/session', true],
        ['GET', null, false],
        ['POST', null, true]
    ])('%s %s needs a session: %s', (method, routeId, expected) => {
        expect(requiresSession(fakeEvent({ method, routeId }))).toBe(expected);
    });

    // The router decodes the path before matching, so an encoded admin path gets the admin route
    // id; deciding on the id rather than on the raw path is what keeps such a request out.
    it('decides on the route id, not on the raw path', () => {
        const event = fakeEvent({
            path: '/api/%61dmin/list-backups',
            routeId: '/api/admin/list-backups'
        });
        expect(requiresSession(event)).toBe(true);
    });
});

describe('sessions', () => {
    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(START);
        await db.delete(sessions);
        await db.delete(appSettings);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('finds the session again from the cookie of the login', async () => {
        const cookies = fakeCookies();
        const session = await createSession(cookies, HTTP_URL);

        expect(await getSession(cookies)).toEqual(session);
        expect(await getSession(fakeCookies())).toBeNull();
    });

    it('stores only a hash of the token', async () => {
        const cookies = fakeCookies();
        await createSession(cookies, HTTP_URL);

        const [row] = await db.select().from(sessions);
        expect(row.tokenHash).not.toBe(cookies.get('cellar_session'));
        expect(row.tokenHash).not.toContain(cookies.get('cellar_session'));
    });

    it('sets an httpOnly, SameSite=Lax cookie, Secure only over HTTPS', async () => {
        const httpCookies = fakeCookies();
        await createSession(httpCookies, HTTP_URL);
        expect(httpCookies.options.get('cellar_session')).toMatchObject({
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: false
        });

        const httpsCookies = fakeCookies();
        await createSession(httpsCookies, new URL('https://cellar.example'));
        expect(httpsCookies.options.get('cellar_session')).toMatchObject({ secure: true });
    });

    it('expires after 24 hours by default', async () => {
        const cookies = fakeCookies();
        await createSession(cookies, HTTP_URL);

        elapse(24 * HOUR - 1);
        expect(await getSession(cookies)).not.toBeNull();
        elapse(1);
        expect(await getSession(cookies)).toBeNull();
    });

    it('expires after the timeout setting', async () => {
        await setSessionTimeout('2');
        const cookies = fakeCookies();
        await createSession(cookies, HTTP_URL);

        elapse(2 * HOUR);
        expect(await getSession(cookies)).toBeNull();
    });

    it('falls back to 24 hours when the stored timeout is invalid', async () => {
        await setSessionTimeout('0');
        const cookies = fakeCookies();
        await createSession(cookies, HTTP_URL);

        elapse(23 * HOUR);
        expect(await getSession(cookies)).not.toBeNull();
    });

    it('purges expired sessions at the next login', async () => {
        await createSession(fakeCookies(), HTTP_URL);
        elapse(25 * HOUR);
        await createSession(fakeCookies(), HTTP_URL);

        expect(await db.select().from(sessions)).toHaveLength(1);
    });

    it('ends the session and clears its cookie on logout, leaving the others', async () => {
        const cookies = fakeCookies();
        const otherCookies = fakeCookies();
        const session = await createSession(cookies, HTTP_URL);
        await createSession(otherCookies, HTTP_URL);

        await destroySession(cookies, HTTP_URL, session);

        expect(cookies.get('cellar_session')).toBeUndefined();
        // Same options as when set, or a browser would keep the cookie.
        expect(cookies.options.get('cellar_session')).toMatchObject({ path: '/', secure: false });
        expect(await db.select().from(sessions)).toHaveLength(1);
        expect(await getSession(otherCookies)).not.toBeNull();
    });

    it('keeps only the given session', async () => {
        const cookies = fakeCookies();
        const otherCookies = fakeCookies();
        const session = await createSession(cookies, HTTP_URL);
        await createSession(otherCookies, HTTP_URL);

        keepOnlySession(session);

        expect(await getSession(cookies)).toEqual(session);
        expect(await getSession(otherCookies)).toBeNull();
    });

    describe('authenticate', () => {
        it.each([
            ['a write', 'POST', '/api/definitions'],
            ['an admin read', 'GET', '/api/admin/list-backups']
        ])('answers 401 to %s without a session', async (_, method, routeId) => {
            const response = await authenticate(fakeEvent({ method, routeId }));

            expect(response?.status).toBe(401);
        });

        it('lets a public read through without a session', async () => {
            const event = fakeEvent({ routeId: '/api/wines' });

            expect(await authenticate(event)).toBeNull();
            expect(event.locals.session).toBeNull();
        });

        it('lets a request with a valid session cookie through, with its session', async () => {
            const cookies = fakeCookies();
            const session = await createSession(cookies, HTTP_URL);
            const event = fakeEvent({
                method: 'POST',
                routeId: '/api/admin/wipe-database',
                cookies
            });

            expect(await authenticate(event)).toBeNull();
            expect(event.locals.session).toEqual(session);
        });

        it('answers 401 once the session has expired', async () => {
            const cookies = fakeCookies();
            await createSession(cookies, HTTP_URL);
            elapse(24 * HOUR);

            const response = await authenticate(
                fakeEvent({ method: 'POST', routeId: '/api/definitions', cookies })
            );

            expect(response?.status).toBe(401);
        });
    });
});
