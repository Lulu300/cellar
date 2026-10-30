import { describe, expect, it, vi } from 'vitest';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { getUpgradeNotice, UPGRADE_ACTIONS_KEY } from '#lib/server/upgrade.js';
import { fakeEvent } from '../../../../test/event';
import { PUT } from './+server';

vi.mock('../../../../../releases.json', async (importOriginal) =>
    (await import('../../../../test/releases')).withOldReleases(importOriginal)
);

type Event = Parameters<typeof PUT>[0];

const put = (body: unknown) =>
    PUT(
        fakeEvent<Event>({
            method: 'PUT',
            path: '/api/admin/upgrade-actions',
            routeId: '/api/admin/upgrade-actions',
            body
        })
    );

describe('PUT /api/admin/upgrade-actions', () => {
    it('ticks a listed action, which the admin then no longer shows', async () => {
        setAppSetting(
            UPGRADE_ACTIONS_KEY,
            JSON.stringify([{ version: '0.3.0', index: 0, mayBeDone: false, done: false }])
        );
        expect(getUpgradeNotice().actions).toHaveLength(1);

        const response = await put({ version: '0.3.0', index: 0, done: true });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            version: '0.3.0',
            index: 0,
            mayBeDone: false,
            done: true
        });
        expect(getUpgradeNotice().actions).toEqual([]);
    });

    it('answers 404 for an action that is not listed', async () => {
        expect((await put({ version: '99.0.0', index: 0, done: true })).status).toBe(404);
    });

    it('answers 400 for a body that is not JSON', async () => {
        expect((await put('not json')).status).toBe(400);
    });

    it('answers 422 for a body that is not { version, index, done }', async () => {
        for (const body of [
            { version: '0.3.0', index: '0', done: true },
            { version: '0.3.0', index: 0.5, done: true },
            { version: '0.3.0', index: 0, done: 'yes' },
            { index: 0, done: true }
        ]) {
            expect((await put(body)).status).toBe(422);
        }
    });
});
