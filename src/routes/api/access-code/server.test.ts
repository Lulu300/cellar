import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, sessions } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import {
    ACCESS_CODE_KEY,
    getStoredAccessCode,
    hashAccessCode,
    verifyAccessCode
} from '#lib/server/access-code.js';
import { createSession, getSession } from '#lib/server/session.js';
import { fakeCookies, fakeEvent, newClient } from '../../../test/event';
import { GET, POST, PUT } from './+server';

type Event = Parameters<typeof POST>[0];
type Init = Parameters<typeof fakeEvent>[0];

const ROUTE = { path: '/api/access-code', routeId: '/api/access-code' };
const get = () => GET(fakeEvent<Event>(ROUTE));
const post = (init: Init) => POST(fakeEvent<Event>({ ...ROUTE, method: 'POST', ...init }));
const put = (init: Init) => PUT(fakeEvent<Event>({ ...ROUTE, method: 'PUT', ...init }));

describe('first access code, while none is set', () => {
    let setupToken: string;

    beforeAll(async () => {
        // The token only ever appears in the server logs.
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        expect(await (await get()).json()).toEqual({ exists: false });
        const announcement = log.mock.calls.flat().join('\n');
        setupToken = /\b[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}\b/.exec(
            announcement
        )![0];
        log.mockRestore();
    });

    beforeEach(async () => {
        await db.delete(appSettings);
    });

    it.each([
        ['no setup token', { newCode: 'cave-2026' }],
        ['a setup token over 64 characters', { newCode: 'cave-2026', setupToken: 'A'.repeat(65) }],
        ['a code under 4 characters', { newCode: 'abc', setupToken: 'ANY' }],
        ['a code over 256 characters', { newCode: 'a'.repeat(257), setupToken: 'ANY' }]
    ])('answers 422 to %s', async (_, body) => {
        expect((await post({ body, client: newClient() })).status).toBe(422);
    });

    it('answers 403 to a wrong setup token', async () => {
        const response = await post({
            body: { newCode: 'cave-2026', setupToken: 'AAAA-AAAA-AAAA' },
            client: newClient()
        });

        expect(response.status).toBe(403);
        expect(await getStoredAccessCode(db)).toBeUndefined();
    });

    it('sets the code, logs in and ends sessions opened under an earlier code', async () => {
        const earlierCookies = fakeCookies();
        await createSession(earlierCookies, new URL('http://localhost'));
        const cookies = fakeCookies();
        // Typed the way it is easiest to, without dashes and in lower case.
        const typedToken = setupToken.replaceAll('-', '').toLowerCase();

        const response = await post({
            body: { newCode: 'cave-2026', setupToken: typedToken },
            cookies,
            client: newClient()
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ valid: true });
        expect(await verifyAccessCode('cave-2026', (await getStoredAccessCode(db))!)).toBe(true);
        expect(await getSession(cookies)).not.toBeNull();
        expect(await getSession(earlierCookies)).toBeNull();
    });
});

describe('with an access code', () => {
    let hash: string;

    beforeAll(async () => {
        hash = await hashAccessCode('cave-2026');
    });

    beforeEach(async () => {
        await db.delete(appSettings);
        await db.delete(sessions);
        setAppSetting(ACCESS_CODE_KEY, hash);
    });

    it('answers 409 to choosing a first code', async () => {
        const response = await post({
            body: { newCode: 'other-code', setupToken: 'ANY' },
            client: newClient()
        });

        expect(response.status).toBe(409);
        expect(await (await get()).json()).toEqual({ exists: true });
        expect(await getStoredAccessCode(db)).toBe(hash);
    });

    describe('login', () => {
        it('answers 400 to a body that is not JSON', async () => {
            expect((await post({ body: 'not json', client: newClient() })).status).toBe(400);
        });

        it.each([
            ['a body that is not an object', 'null'],
            ['no code', {}],
            ['an empty code', { code: '' }],
            ['a code that is not a string', { code: 1234 }],
            ['a code over 256 characters', { code: 'a'.repeat(257) }]
        ])('answers 422 to %s', async (_, body) => {
            expect((await post({ body, client: newClient() })).status).toBe(422);
        });

        it('starts a session for the right code', async () => {
            const cookies = fakeCookies();

            const response = await post({
                body: { code: 'cave-2026' },
                cookies,
                client: newClient()
            });

            expect(await response.json()).toEqual({ valid: true });
            expect(await getSession(cookies)).not.toBeNull();
        });

        it('starts no session for a wrong code', async () => {
            const cookies = fakeCookies();

            const response = await post({ body: { code: 'wrong' }, cookies, client: newClient() });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ valid: false });
            expect(cookies.get('cellar_session')).toBeUndefined();
        });

        it('forgets the earlier mistakes of a client that gives the right code', async () => {
            const client = newClient();
            for (let i = 0; i < 4; i++) await post({ body: { code: 'wrong' }, client });
            await post({ body: { code: 'cave-2026' }, client });

            for (let i = 0; i < 5; i++) {
                expect((await post({ body: { code: 'wrong' }, client })).status).toBe(200);
            }
        });

        it('answers 429 to the 6th attempt in a minute, even with the right code', async () => {
            const client = newClient();
            for (let i = 0; i < 5; i++) await post({ body: { code: 'wrong' }, client });

            const response = await post({ body: { code: 'cave-2026' }, client });

            expect(response.status).toBe(429);
            const retryAfter = Number(response.headers.get('Retry-After'));
            expect(retryAfter).toBeGreaterThan(0);
            expect((await response.json()).error).toMatchObject({
                code: 'too_many_attempts',
                details: { retryAfter }
            });
        });
    });

    describe('code change', () => {
        it.each([
            ['no current code', { newCode: 'new-code' }],
            ['no new code', { currentCode: 'cave-2026' }],
            ['a new code under 4 characters', { currentCode: 'cave-2026', newCode: 'abc' }],
            [
                'a current code over 256 characters',
                { currentCode: 'a'.repeat(257), newCode: 'new-code' }
            ]
        ])('answers 422 to %s', async (_, body) => {
            expect((await put({ body, client: newClient() })).status).toBe(422);
        });

        // Not 401, which the client takes for an expired session.
        it('answers 403 to a wrong current code', async () => {
            const response = await put({
                body: { currentCode: 'wrong', newCode: 'new-code' },
                client: newClient()
            });

            expect(response.status).toBe(403);
            expect(await getStoredAccessCode(db)).toBe(hash);
        });

        it('changes the code and ends every other session', async () => {
            const url = new URL('http://localhost');
            const cookies = fakeCookies();
            const otherCookies = fakeCookies();
            const session = await createSession(cookies, url);
            await createSession(otherCookies, url);

            const response = await put({
                body: { currentCode: 'cave-2026', newCode: 'new-code' },
                cookies,
                session,
                client: newClient()
            });

            // No body: the code is a secret.
            expect(response.status).toBe(204);
            expect(await response.text()).toBe('');
            const stored = (await getStoredAccessCode(db))!;
            expect(await verifyAccessCode('new-code', stored)).toBe(true);
            expect(await verifyAccessCode('cave-2026', stored)).toBe(false);
            expect(await getSession(cookies)).not.toBeNull();
            expect(await getSession(otherCookies)).toBeNull();
        });
    });
});
