import { describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { APP_VERSION_KEY } from '#lib/server/upgrade.js';
import { backupZip, restore } from '../../../../test/restore';

describe('POST /api/admin/restore', () => {
    // 1.0.0 counted an emoji as one character in a name: 250 emoji and a letter were 251
    // characters for it, and are 501 UTF-16 units, over the 500 of a name now (API-13).
    it('restores and upgrades a backup of 1.0.0 whose names are too long now, keeping them whole', async () => {
        const name = `${'🍷'.repeat(250)}a`;
        const now = new Date();
        const file = backupZip((backup) => {
            setAppSetting(APP_VERSION_KEY, '1.0.0', backup);
            backup
                .insert(countries)
                .values({ id: 'emoji', name, createdAt: now, updatedAt: now })
                .run();
        });

        const response = await restore(file);

        expect(response.status).toBe(200);
        expect(db.select().from(countries).all()).toMatchObject([{ id: 'emoji', name }]);
    });
});
