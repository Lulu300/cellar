import { readFileSync } from 'node:fs';
import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { openDatabase } from '#lib/server/db/connection.js';
import { appSettings } from '#lib/server/db/schema.js';
import { getAppSetting, setAppSetting } from '#lib/server/features/settings/repository.js';
import { checkReleases, findRelease, type Release } from '#lib/server/releases.js';
import { migrationsBefore, openOldDatabase } from '../../test/database';
import releasesJson from '../../../releases.json';
import {
    APP_VERSION_KEY,
    getUpgradeNotice,
    missingPrerequisite,
    planUpgrade,
    readPreviousStart,
    recordStartup,
    setUpgradeActionDone,
    UNRECORDED_VERSIONS,
    UPGRADE_ACTIONS_KEY,
    UpgradeRefusal,
    type PreviousStart
} from './upgrade';

const RELEASES = checkReleases(releasesJson);

const release = (version: string, actions: string[], mandatoryStop = false): Release => ({
    version,
    summary: `Version ${version}.`,
    mandatoryStop,
    actions
});

// Like releases.json, newest first, with a mandatory stop at 0.4.0.
const WITH_STOP = [
    release('0.5.0', ['Do E.']),
    release('0.4.0', ['Do D.'], true),
    release('0.3.0', ['Do C.']),
    release('0.2.0', ['Do A.', 'Do B.']),
    release('0.1.0', [])
];

const recorded = (version: string): PreviousStart => ({ kind: 'recorded', version });

/** The start of a database whose newest migration comes before `tag`, as an older version left it. */
function startOfDatabaseBefore(tag: string): PreviousStart {
    const database = openOldDatabase(':memory:', migrationsBefore(tag));
    try {
        return readPreviousStart(database);
    } finally {
        database.$client.close();
    }
}

const summary = (actions: { version: string; index: number; mayBeDone: boolean }[]) =>
    actions.map(({ version, index, mayBeDone }) => `${version}#${index}${mayBeDone ? '?' : ''}`);

afterEach(() => {
    vi.restoreAllMocks();
});

beforeEach(() => {
    db.delete(appSettings)
        .where(inArray(appSettings.key, [APP_VERSION_KEY, UPGRADE_ACTIONS_KEY]))
        .run();
});

describe('planUpgrade', () => {
    it('lists the actions of each version after the recorded one, oldest first', () => {
        const plan = planUpgrade(WITH_STOP, '0.4.0', recorded('0.2.0'));

        expect(plan.upgraded).toBe(true);
        expect(summary(plan.actions)).toEqual(['0.3.0#0', '0.4.0#0']);
    });

    it('asks nothing on a new database', () => {
        expect(planUpgrade(WITH_STOP, '0.5.0', { kind: 'fresh' })).toEqual({
            current: '0.5.0',
            from: null,
            upgraded: false,
            actions: []
        });
    });

    it('asks nothing again of the same version, a later rc of it or its final version', () => {
        for (const [previous, current] of [
            ['0.3.0', '0.3.0'],
            ['0.3.0-rc.1', '0.3.0-rc.2'],
            ['0.3.0-rc.1', '0.3.0']
        ]) {
            const plan = planUpgrade(WITH_STOP, current, recorded(previous));

            expect(plan.upgraded).toBe(false);
            expect(plan.actions).toEqual([]);
        }
    });

    it('counts a release candidate as its final version for the actions', () => {
        const plan = planUpgrade(WITH_STOP, '0.4.0-rc.1', recorded('0.2.0-rc.1'));

        expect(summary(plan.actions)).toEqual(['0.3.0#0', '0.4.0#0']);
    });

    it('refuses a database that a later rc or the final version used', () => {
        for (const [previous, current] of [
            ['0.3.0', '0.3.0-rc.2'],
            ['0.3.0-rc.2', '0.3.0-rc.1']
        ]) {
            expect(() => planUpgrade(WITH_STOP, current, recorded(previous))).toThrow(
                new UpgradeRefusal(
                    `this database comes from ${previous}, newer than this ${current}: start ${previous} again, or restore a backup made before the upgrade.`,
                    `This backup comes from ${previous}, newer than this ${current}: restore it with ${previous} or later.`,
                    { kind: 'newer', backupVersion: previous, currentVersion: current }
                )
            );
        }
    });

    it('refuses a database that a newer version used, naming both versions', () => {
        expect(() => planUpgrade(WITH_STOP, '0.3.0', recorded('0.4.0-rc.1'))).toThrow(
            new UpgradeRefusal(
                'this database comes from 0.4.0-rc.1, newer than this 0.3.0: start 0.4.0-rc.1 again, or restore a backup made before the upgrade.',
                'This backup comes from 0.4.0-rc.1, newer than this 0.3.0: restore it with 0.4.0-rc.1 or later.',
                { kind: 'newer', backupVersion: '0.4.0-rc.1', currentVersion: '0.3.0' }
            )
        );
    });

    it('refuses to skip a mandatory stop, naming the version to install first', () => {
        expect(() => planUpgrade(WITH_STOP, '0.5.0', recorded('0.3.0'))).toThrow(
            new UpgradeRefusal(
                'this database was last used by 0.3.0, and upgrading to 0.5.0 skips the mandatory stop 0.4.0. Install 0.4.0 first and start it once, then install 0.5.0 again.',
                'This backup comes from 0.3.0, before the mandatory stop 0.4.0: restore it with 0.4.0, then restart that version once, back it up again, and restore that new backup here.',
                {
                    kind: 'mandatory_stop',
                    backupVersion: '0.3.0',
                    orOlder: false,
                    stopVersion: '0.4.0',
                    currentVersion: '0.5.0'
                }
            )
        );
    });

    it('lets an upgrade end on a mandatory stop, or start from it', () => {
        expect(summary(planUpgrade(WITH_STOP, '0.4.0', recorded('0.3.0')).actions)).toEqual([
            '0.4.0#0'
        ]);
        expect(summary(planUpgrade(WITH_STOP, '0.5.0', recorded('0.4.0')).actions)).toEqual([
            '0.5.0#0'
        ]);
    });
});

describe('a database from a version that did not record itself', () => {
    it('is known to come from 0.1.0 by its migrations, so every later action is due', () => {
        const plan = planUpgrade(RELEASES, '0.5.0', startOfDatabaseBefore('0003_modern_caretaker'));

        expect(plan.from).toEqual({ lowest: '0.1.0', highest: '0.1.0', recorded: false });
        expect(summary(plan.actions)).toEqual([
            ...['0.2.0#0', '0.2.0#1', '0.2.0#2', '0.2.0#3', '0.2.0#4', '0.2.0#5'],
            ...['0.3.0#0', '0.4.0#0', '0.5.0#0']
        ]);
    });

    it('marks the actions of the versions it may come from as may be done', () => {
        const from03 = planUpgrade(
            RELEASES,
            '0.5.0',
            startOfDatabaseBefore('0004_remove_csv_header_appellation')
        );
        const from05 = planUpgrade(
            RELEASES,
            '0.5.0',
            startOfDatabaseBefore('0005_label_preset_spacing')
        );

        expect(from03.from).toEqual({ lowest: '0.2.0', highest: '0.3.0', recorded: false });
        expect(summary(from03.actions)).toEqual(['0.3.0#0?', '0.4.0#0', '0.5.0#0']);
        expect(from05.from).toEqual({ lowest: '0.4.0', highest: '0.5.0', recorded: false });
        expect(summary(from05.actions)).toEqual(['0.5.0#0?']);
    });

    it('is taken for 0.1.0 when it is older still', () => {
        const plan = planUpgrade(RELEASES, '0.5.0', startOfDatabaseBefore('0002_fine_nextwave'));

        expect(plan.from).toEqual({ lowest: '0.1.0', highest: '0.1.0', recorded: false });
    });

    it('is mapped from migrations of the journal, oldest first', () => {
        const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
        const tagOf = (when: number) =>
            journal.entries.find((entry: { when: number }) => entry.when === when)?.tag;

        expect(UNRECORDED_VERSIONS.map((entry) => tagOf(entry.lastMigration))).toEqual([
            '0002_fine_nextwave',
            '0003_modern_caretaker',
            '0004_remove_csv_header_appellation'
        ]);
    });
});

describe('readPreviousStart', () => {
    it('finds a new database, then the version recorded in it', async () => {
        const database = openDatabase(':memory:');
        try {
            expect(readPreviousStart(database)).toEqual({ kind: 'fresh' });
        } finally {
            database.$client.close();
        }

        setAppSetting(APP_VERSION_KEY, '0.6.0-rc.1');
        expect(readPreviousStart()).toEqual(recorded('0.6.0-rc.1'));
    });

    // Before the migrations, app_settings may lack a column that this version's schema declares.
    it('reads the version from a settings table older than the schema', () => {
        const database = openOldDatabase(':memory:', migrationsBefore('0005_label_preset_spacing'));
        try {
            database.$client.exec(
                "INSERT INTO app_settings VALUES ('v', 'app_version', '0.6.0', 0, 0); ALTER TABLE app_settings DROP COLUMN updated_at"
            );

            expect(readPreviousStart(database)).toEqual(recorded('0.6.0'));
        } finally {
            database.$client.close();
        }
    });
});

it('has an entry in releases.json for the version of package.json', () => {
    expect(findRelease(RELEASES, __APP_VERSION__).version).toBe(
        __APP_VERSION__.replace(/-rc\.\d+$/, '')
    );
});

describe('recordStartup', () => {
    const fromV010: PreviousStart = { kind: 'unrecorded', lastMigration: 1766167130064 };
    // The version that starts in these tests, whatever package.json says.
    const CURRENT = '0.5.0';

    it('records this version, and logs the actions of an upgrade from v0.1.0 for the admin', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        recordStartup(planUpgrade(RELEASES, CURRENT, fromV010));

        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe(CURRENT);
        const logged = log.mock.calls.map(([line]) => line).join('\n');
        expect(logged).toContain(`Cellar upgraded from 0.1.0 (judged from the database migrations`);
        expect(logged).toContain(`did not record itself) to ${CURRENT}.`);
        expect(logged).toMatch(/ {2}- 0\.2\.0: Set `ORIGIN` to the exact URL/);
        expect(logged).toMatch(/ {2}- 0\.5\.0: Only if you run Cellar from source/);
        const { actions } = getUpgradeNotice();
        expect(actions).toHaveLength(9);
        expect(actions[0]).toMatchObject({ version: '0.2.0', index: 0, mayBeDone: false });
        expect(actions[0].text).toMatch(/^Set `ORIGIN` to the exact URL/);
    });

    it('keeps the actions left to do at the next upgrade, and drops those done', async () => {
        recordStartup(planUpgrade(WITH_STOP, '0.3.0', recorded('0.1.0')));
        // The texts of WITH_STOP are not those of releases.json: compare the stored list.
        expect(setUpgradeActionDone('0.2.0', 1, true)).toMatchObject({ done: true });

        recordStartup(planUpgrade(WITH_STOP, '0.4.0', recorded('0.3.0')));

        const stored = JSON.parse(getAppSetting(UPGRADE_ACTIONS_KEY)!.value);
        expect(summary(stored)).toEqual(['0.2.0#0', '0.3.0#0', '0.4.0#0']);
    });

    it('counts only the actions that releases.json still has, as the admin shows them', async () => {
        setAppSetting(
            UPGRADE_ACTIONS_KEY,
            JSON.stringify([
                { version: '0.3.0', index: 0, mayBeDone: false, done: false },
                { version: '0.3.0', index: 7, mayBeDone: false, done: false }
            ])
        );
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        recordStartup(planUpgrade(RELEASES, CURRENT, recorded(CURRENT)));

        expect(log).toHaveBeenCalledWith('📋 1 upgrade action(s) still to take: see Admin.');
    });

    it('starts despite a damaged list, keeping the actions it can read', async () => {
        const valid = { version: '0.3.0', index: 0, mayBeDone: false, done: false };
        setAppSetting(
            UPGRADE_ACTIONS_KEY,
            JSON.stringify([null, 1, { version: 3 }, { ...valid, index: '0' }, valid])
        );
        vi.spyOn(console, 'log').mockImplementation(() => {});

        recordStartup(planUpgrade(RELEASES, CURRENT, recorded(CURRENT)));

        expect(JSON.parse(getAppSetting(UPGRADE_ACTIONS_KEY)!.value)).toEqual([valid]);

        setAppSetting(UPGRADE_ACTIONS_KEY, '{"not":');
        recordStartup(planUpgrade(RELEASES, CURRENT, recorded(CURRENT)));

        expect(getAppSetting(UPGRADE_ACTIONS_KEY)!.value).toBe('[]');
    });

    it('logs only how many actions are left when the version did not change', () => {
        recordStartup(planUpgrade(RELEASES, CURRENT, fromV010));
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        recordStartup(planUpgrade(RELEASES, CURRENT, recorded(CURRENT)));

        expect(log.mock.calls.map(([line]) => line)).toEqual([
            `✅ Cellar ${CURRENT}: same version as the last start.`,
            '📋 9 upgrade action(s) still to take: see Admin.'
        ]);
    });

    it('says when the last start was a release candidate of the same version', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        recordStartup(planUpgrade(RELEASES, CURRENT, recorded('0.5.0-rc.1')));

        expect(log).toHaveBeenCalledWith(
            `✅ Cellar ${CURRENT}: the last start was 0.5.0-rc.1, which counts as the same version.`
        );
        expect(getAppSetting(APP_VERSION_KEY)?.value).toBe(CURRENT);
    });
});

describe('setUpgradeActionDone', () => {
    it('hides a ticked action from the admin, and shows it again once unticked', async () => {
        recordStartup(planUpgrade(RELEASES, '0.3.0', recorded('0.2.0')));

        expect(setUpgradeActionDone('0.3.0', 0, true)).toMatchObject({ done: true });
        expect(getUpgradeNotice().actions).toEqual([]);
        expect(setUpgradeActionDone('0.3.0', 0, false)).toMatchObject({ done: false });
        expect(getUpgradeNotice().actions).toHaveLength(1);
    });

    it('refuses an action that is not listed', async () => {
        recordStartup(planUpgrade(RELEASES, '0.3.0', recorded('0.2.0')));

        expect(setUpgradeActionDone('0.2.0', 0, true)).toBeUndefined();
        expect(setUpgradeActionDone('0.3.0', 1, true)).toBeUndefined();
    });
});

describe('missingPrerequisite', () => {
    it('names ORIGIN when nothing tells the server its URL', () => {
        expect(missingPrerequisite({}, false)).toBe('origin');
    });

    it('names server.js when ORIGIN is set but was not applied', () => {
        expect(missingPrerequisite({ ORIGIN: 'http://192.168.1.20:3000' }, false)).toBe(
            'server-js'
        );
    });

    it('accepts the headers of a reverse proxy, or of server.js', () => {
        expect(
            missingPrerequisite({ PROTOCOL_HEADER: 'x-proto', HOST_HEADER: 'x-host' }, false)
        ).toBe(null);
        expect(missingPrerequisite({ HOST_HEADER: 'x-forwarded-host' }, false)).toBe(null);
    });

    it('asks nothing of the dev server', () => {
        expect(missingPrerequisite({}, true)).toBe(null);
    });
});
