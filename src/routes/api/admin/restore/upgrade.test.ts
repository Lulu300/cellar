import { readdirSync, rmSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, countries } from '#lib/server/db/schema.js';
import { getAppSetting, setAppSetting } from '#lib/server/features/settings/repository.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { checkReleases } from '#lib/server/releases.js';
import {
    APP_VERSION_KEY,
    planUpgrade,
    UPGRADE_ACTIONS_KEY,
    type PendingAction
} from '#lib/server/upgrade.js';
import releasesJson from '../../../../../releases.json';
import { migrationsBefore } from '../../../../test/database';
import { backupZip, restore } from '../../../../test/restore';

vi.mock('../../../../../releases.json', async (importOriginal) =>
    (await import('../../../../test/releases')).withOldReleases(importOriginal)
);

const timestamps = { createdAt: new Date(), updatedAt: new Date() };
// A database of 0.4.0 or 0.5.0, which did not record their version.
const migrations05 = migrationsBefore('0005_label_preset_spacing');
const LIVE_ACTIONS = JSON.stringify([
    { version: '0.3.0', index: 0, mayBeDone: false, done: false }
]);

afterAll(() => {
    rmSync(migrations05, { recursive: true, force: true });
});

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    setAppSetting(APP_VERSION_KEY, __APP_VERSION__);
    setAppSetting(UPGRADE_ACTIONS_KEY, LIVE_ACTIONS);
});

/** The actions of the versions after `version`, up to this one. */
const actionsFrom = (version: string) =>
    planUpgrade(checkReleases(releasesJson), __APP_VERSION__, { kind: 'recorded', version })
        .actions;

const storedActions = (): PendingAction[] =>
    JSON.parse(getAppSetting(UPGRADE_ACTIONS_KEY)?.value ?? 'null');

const preRestoreBackups = () =>
    readdirSync(DATA_DIR).filter((name) => name.includes('pre-restore'));

describe('POST /api/admin/restore and the upgrade check', () => {
    it('refuses a backup from a newer version with 409, before anything is written', async () => {
        db.insert(countries)
            .values({ id: 'live', name: 'Live country', ...timestamps })
            .run();
        const before = preRestoreBackups();
        const file = backupZip((backup) => {
            setAppSetting(APP_VERSION_KEY, '99.0.0', backup);
            backup
                .insert(countries)
                .values({ id: 'new', name: 'From 99', ...timestamps })
                .run();
        });

        const response = await restore(file);

        expect(response.status).toBe(409);
        expect((await response.clone().json()).error).toMatchObject({
            code: 'backup_refused',
            details: {
                kind: 'newer',
                backupVersion: '99.0.0',
                currentVersion: __APP_VERSION__
            }
        });
        expect((await response.json()).error.message).toBe(
            `This backup comes from 99.0.0, newer than this ${__APP_VERSION__}: restore it with 99.0.0 or later.`
        );
        const names = db
            .select()
            .from(countries)
            .all()
            .map((country) => country.name);
        expect(names).toContain('Live country');
        expect(names).not.toContain('From 99');
        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe(__APP_VERSION__);
        expect(preRestoreBackups()).toEqual(before);
    });

    it('answers 422 for a backup whose recorded version cannot be read', async () => {
        const file = backupZip((backup) => setAppSetting(APP_VERSION_KEY, 'not a version', backup));

        const response = await restore(file);

        expect(response.status).toBe(422);
        expect((await response.clone().json()).error.details).toEqual({
            problem: 'unknown_version',
            version: 'not a version',
            reason: 'Its recorded version "not a version" is not a Cellar release.'
        });
        expect((await response.json()).error.message).toBe(
            'Invalid backup: Its recorded version "not a version" is not a Cellar release.'
        );
    });

    it('answers 422 for cellar tables without a record of their migrations', async () => {
        const before = preRestoreBackups();
        for (const sql of ['DROP TABLE __drizzle_migrations', 'DELETE FROM __drizzle_migrations']) {
            const response = await restore(backupZip((backup) => backup.$client.exec(sql)));

            expect(response.status).toBe(422);
            expect((await response.clone().json()).error.details.problem).toBe('no_migrations');
            expect((await response.json()).error.message).toBe(
                'Invalid backup: It has the tables of a cellar but no record of its migrations.'
            );
        }
        expect(preRestoreBackups()).toEqual(before);
    });

    it("records this version, and adds the backup version's actions to the instance's as maybe done", async () => {
        const file = backupZip((backup) => {
            setAppSetting(APP_VERSION_KEY, '0.8.0', backup);
            // Never taken: what the backup's own installation still had to do.
            setAppSetting(
                UPGRADE_ACTIONS_KEY,
                '[{"version":"0.2.0","index":0,"mayBeDone":false,"done":false}]',
                backup
            );
        });

        const response = await restore(file);

        expect(response.status).toBe(200);
        // So the next start finds the version that migrated it, and shows no action again.
        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe(__APP_VERSION__);
        const backupActions = actionsFrom('0.8.0').map((action) => ({
            ...action,
            mayBeDone: true
        }));
        expect(backupActions).toContainEqual({
            version: '0.9.0',
            index: 0,
            mayBeDone: true,
            done: false
        });
        expect(storedActions()).toEqual([...JSON.parse(LIVE_ACTIONS), ...backupActions]);
    });

    it('lists an action of the backup version once, as the instance has it', async () => {
        const ticked = [{ version: '0.9.0', index: 0, mayBeDone: false, done: true }];
        setAppSetting(UPGRADE_ACTIONS_KEY, JSON.stringify(ticked));
        const file = backupZip((backup) => setAppSetting(APP_VERSION_KEY, '0.8.0', backup));

        expect((await restore(file)).status).toBe(200);

        const actions = storedActions();
        expect(actions.filter(({ version, index }) => version === '0.9.0' && index === 0)).toEqual(
            ticked
        );
        expect(actions).toHaveLength(actionsFrom('0.8.0').length);
    });

    it('adds the actions of an older version that did not record itself', async () => {
        const file = backupZip(() => {}, { migrationsFolder: migrations05 });

        expect((await restore(file)).status).toBe(200);

        expect(storedActions()).toContainEqual({
            version: '0.5.0',
            index: 0,
            mayBeDone: true,
            done: false
        });
    });

    it("keeps the instance's actions as they are for a backup of this version", async () => {
        db.delete(appSettings).where(eq(appSettings.key, UPGRADE_ACTIONS_KEY)).run();
        const file = backupZip((backup) => {
            setAppSetting(APP_VERSION_KEY, __APP_VERSION__, backup);
            setAppSetting(UPGRADE_ACTIONS_KEY, '[{"version":"0.5.0","index":0}]', backup);
        });

        expect((await restore(file)).status).toBe(200);

        expect(getAppSetting(UPGRADE_ACTIONS_KEY)).toBeUndefined();
    });
});
