import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { SESSION_TIMEOUT_KEY } from '#lib/server/session.js';
import { fakeEvent } from '../../../test/event';
import { GET, PUT } from './+server';

type Event = Parameters<typeof PUT>[0];

const ROUTE = { path: '/api/settings', routeId: '/api/settings' };
const put = (body: unknown) => PUT(fakeEvent<Event>({ ...ROUTE, method: 'PUT', body }));
const getTimeout = async () =>
    (await (await GET(fakeEvent<Event>(ROUTE))).json()).sessionTimeoutHours;

// Seeded at startup, which the tests do not run.
const seedTimeout = () => setAppSetting(SESSION_TIMEOUT_KEY, '24');

describe('session timeout setting', () => {
    beforeEach(async () => {
        await db.delete(appSettings);
    });

    it('reads 24 hours when the setting is missing', async () => {
        expect(await getTimeout()).toBe(24);
    });

    it('saves a whole number of hours from 1 to 168', async () => {
        await seedTimeout();

        const response = await put({ sessionTimeoutHours: 168 });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ sessionTimeoutHours: 168 });
        expect(await getTimeout()).toBe(168);
    });

    it.each([0, 169, 1.5, '24', null])('answers 422 to %j and keeps the setting', async (hours) => {
        await seedTimeout();

        const response = await put({ sessionTimeoutHours: hours });

        expect(response.status).toBe(422);
        expect(await getTimeout()).toBe(24);
    });

    it('answers 400 to a body that is not JSON', async () => {
        const response = await put('not json');

        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('malformed_body');
    });

    it('saves the timeout when the setting was never seeded', async () => {
        await put({ sessionTimeoutHours: 48 });

        expect(await getTimeout()).toBe(48);
    });
});
