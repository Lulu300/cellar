import { describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { APP_VERSION_KEY } from '#lib/server/upgrade.js';
import { backupZip, restore } from '../../../../test/restore';

// releases.json and older versions, with 0.4.0 as a mandatory stop.
vi.mock('../../../../../releases.json', async (importOriginal) =>
    (await import('../../../../test/releases')).withOldReleases(importOriginal, '0.4.0')
);

describe('POST /api/admin/restore', () => {
    it('refuses with 409 a backup from before a mandatory stop that this version passed', async () => {
        const now = new Date();
        const file = backupZip((backup) => {
            setAppSetting(APP_VERSION_KEY, '0.3.0', backup);
            backup
                .insert(countries)
                .values({ id: 'old', name: 'From 0.3.0', createdAt: now, updatedAt: now })
                .run();
        });

        const response = await restore(file);

        expect(response.status).toBe(409);
        expect((await response.clone().json()).error.details).toMatchObject({
            kind: 'mandatory_stop',
            backupVersion: '0.3.0',
            orOlder: false,
            stopVersion: '0.4.0'
        });
        expect((await response.json()).error.message).toBe(
            'This backup comes from 0.3.0, before the mandatory stop 0.4.0: restore it with 0.4.0, then restart that version once, back it up again, and restore that new backup here.'
        );
        expect(
            db
                .select()
                .from(countries)
                .all()
                .map((country) => country.name)
        ).not.toContain('From 0.3.0');
    });
});
