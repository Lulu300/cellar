import { describe, expect, it, vi } from 'vitest';
import { reschedule } from '#lib/server/features/backup/scheduler.js';
import { fakeEvent } from '../../../../test/event';
import { POST as createToken } from '../backup-token/+server';
import { GET, PUT } from './+server';

vi.mock('#lib/server/features/backup/scheduler.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('#lib/server/features/backup/scheduler.js')>()),
    reschedule: vi.fn()
}));

const settings = async () =>
    (
        await GET(fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/admin/backup-settings' }))
    ).json();

const save = (body: unknown) =>
    PUT(
        fakeEvent<Parameters<typeof PUT>[0]>({
            method: 'PUT',
            path: '/api/admin/backup-settings',
            routeId: '/api/admin/backup-settings',
            body
        })
    );

const valid = {
    autoBackupEnabled: true,
    autoBackupInterval: 12,
    autoBackupKeepCount: 5,
    autoBackupMode: 'cron'
};

describe('/api/admin/backup-settings', () => {
    it('saves the cron mode and plans the backups again at once', async () => {
        const response = await save(valid);

        expect(response.status).toBe(200);
        // The settings as saved, as GET gives them.
        expect(await response.json()).toEqual(await settings());
        expect(reschedule).toHaveBeenCalledOnce();
        expect(await settings()).toMatchObject({
            autoBackupEnabled: true,
            autoBackupInterval: 12,
            autoBackupKeepCount: 5,
            autoBackupMode: 'cron'
        });
    });

    it.each([
        ['an interval out of range', { autoBackupInterval: 169 }],
        ['a count out of range', { autoBackupKeepCount: 0 }],
        ['an unknown mode', { autoBackupMode: 'hourly' }],
        ['a state that is not a boolean', { autoBackupEnabled: 'yes' }]
    ])('refuses %s, and changes nothing', async (_, change) => {
        const before = await settings();

        expect((await save({ ...valid, ...change })).status).toBe(422);
        expect(await settings()).toEqual(before);
        expect(reschedule).not.toHaveBeenCalled();
    });

    it('says whether the cron job has a token, never the token itself', async () => {
        expect((await settings()).hasBackupToken).toBe(false);

        const response = await createToken(
            fakeEvent<Parameters<typeof createToken>[0]>({
                method: 'POST',
                path: '/api/admin/backup-token',
                routeId: '/api/admin/backup-token'
            })
        );
        const { token } = await response.json();

        expect(token).toMatch(/^[\w-]{43}$/);
        const after = await settings();
        expect(after.hasBackupToken).toBe(true);
        expect(JSON.stringify(after)).not.toContain(token);
    });
});
