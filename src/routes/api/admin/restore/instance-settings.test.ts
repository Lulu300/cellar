import { inArray } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import type { Db } from '#lib/server/db/connection.js';
import { appSettings, sessions, type Session } from '#lib/server/db/schema.js';
import { getNextBarcodeNumber } from '#lib/server/features/barcode/service.js';
import { setLastBarcodeNumber } from '#lib/server/features/barcode/repository.js';
import { BACKUP_SETTING_KEYS, getBackupSettings } from '#lib/server/features/backup/scheduler.js';
import { setAppSettings } from '#lib/server/features/settings/repository.js';
import { createBackupToken, getBackupTokenHash } from '#lib/server/features/backup/token.js';
import { createSession, keepOnlySession } from '#lib/server/session.js';
import { fakeCookies } from '../../../../test/event';
import { backupZip, restore } from '../../../../test/restore';

// Wrapped, to see which database the restore ends the sessions of, and when.
vi.mock('#lib/server/session.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/session.js')>();
    return { ...module, keepOnlySession: vi.fn(module.keepOnlySession) };
});

const now = new Date();
const timestamps = { createdAt: now, updatedAt: now };

/** Fills a backup with a session of its day, a cron token, its backup settings and the last barcode numbers it gave. */
function fillBackup(backup: Db): void {
    backup
        .insert(sessions)
        .values({
            tokenHash: 'hash of a session of the backup',
            expiresAt: new Date(Date.now() + 3_600_000)
        })
        .run();
    const settings = {
        // As a backup of 0.1.x taken in the cron mode, whose instance has no cron token now.
        [BACKUP_SETTING_KEYS.enabled]: 'true',
        [BACKUP_SETTING_KEYS.mode]: 'cron',
        [BACKUP_SETTING_KEYS.intervalHours]: '6',
        [BACKUP_SETTING_KEYS.keepCount]: '3',
        [BACKUP_SETTING_KEYS.lastBackup]: '2020-01-01T00:00:00.000Z',
        auto_backup_token_hash: 'hash of an older cron token',
        'barcode_last_number:CV': '12',
        'barcode_last_number:LOW': '60',
        'barcode_last_number:OLD': '90'
    };
    for (const [key, value] of Object.entries(settings)) {
        backup
            .insert(appSettings)
            .values({ id: key, key, value, ...timestamps })
            .run();
    }
}

describe('POST /api/admin/restore and the settings of the instance', () => {
    let admin: Session;
    let instanceTokenHash: string | undefined;
    const instanceBackupSettings = {
        [BACKUP_SETTING_KEYS.enabled]: 'true',
        [BACKUP_SETTING_KEYS.mode]: 'internal',
        [BACKUP_SETTING_KEYS.intervalHours]: '24',
        [BACKUP_SETTING_KEYS.keepCount]: '7',
        [BACKUP_SETTING_KEYS.lastBackup]: '2026-10-01T00:00:00.000Z'
    };
    // The sessions of the database keepOnlySession works on, and of the live one, at that moment.
    let sessionsSeen: { worked: string[]; live: string[] } | undefined;

    beforeAll(async () => {
        admin = await createSession(fakeCookies(), new URL('http://localhost'));
        createBackupToken();
        instanceTokenHash = getBackupTokenHash();
        setAppSettings(instanceBackupSettings);
        // Given in the live cellar since the backup was taken, or before it for LOW.
        for (const [prefix, number] of Object.entries({ CV: 40, LOW: 5, LIVE: 7 })) {
            setLastBarcodeNumber(prefix, number);
        }
        const actual =
            await vi.importActual<typeof import('#lib/server/session.js')>(
                '#lib/server/session.js'
            );
        vi.mocked(keepOnlySession).mockImplementationOnce((session, database) => {
            const hashes = (rows: { tokenHash: string }[]) => rows.map((row) => row.tokenHash);
            sessionsSeen = {
                worked: hashes((database ?? db).select().from(sessions).all()),
                live: hashes(db.select().from(sessions).all())
            };
            actual.keepOnlySession(session, database);
        });
        const response = await restore(backupZip(fillBackup), admin);
        expect(response.status).toBe(200);
    });

    it("ends the backup's sessions on its copy, before it replaces the live database", () => {
        expect(sessionsSeen).toEqual({
            worked: ['hash of a session of the backup'],
            live: [admin.tokenHash]
        });
    });

    it('never serves the sessions of the backup', async () => {
        expect((await db.select().from(sessions)).map(({ tokenHash }) => tokenHash)).toEqual([
            admin.tokenHash
        ]);
    });

    it('keeps the cron token of the instance', () => {
        expect(getBackupTokenHash()).toBe(instanceTokenHash);
    });

    it('keeps the automatic backup settings of the instance, its internal mode included', () => {
        expect(getBackupSettings()).toEqual({
            enabled: true,
            mode: 'internal',
            intervalHours: 24,
            keepCount: 7,
            lastBackup: '2026-10-01T00:00:00.000Z'
        });
    });

    describe('keeps for each barcode prefix the higher last number given', () => {
        const nextNumber = (prefix: string) => getNextBarcodeNumber({ prefix, startNumber: 1 });

        it("the live cellar's, so that labels printed since the backup keep their numbers", () => {
            expect(nextNumber('CV')).toBe(41);
        });

        it("the backup's, when it is higher", () => {
            expect(nextNumber('LOW')).toBe(61);
        });

        it('the only one, when a single side used the prefix', () => {
            expect(nextNumber('LIVE')).toBe(8);
            expect(nextNumber('OLD')).toBe(91);
        });
    });
});

describe('POST /api/admin/restore on an instance that never saved its backup settings', () => {
    it('keeps the default settings, in the internal mode, whatever the backup holds', async () => {
        db.delete(appSettings)
            .where(inArray(appSettings.key, Object.values(BACKUP_SETTING_KEYS)))
            .run();

        expect((await restore(backupZip(fillBackup))).status).toBe(200);

        expect(getBackupSettings()).toEqual({
            enabled: false,
            mode: 'internal',
            intervalHours: 24,
            keepCount: 7,
            lastBackup: ''
        });
    });
});
