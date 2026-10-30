import { chmodSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { openDatabase } from '#lib/server/db/connection.js';
import { countries } from '#lib/server/db/schema.js';
import { DATA_DIR, DATABASE_PATH, IMAGES_DIR } from '#lib/server/paths.js';
import { extractZip } from '#lib/server/zip.js';
import { countryNamesInDbFile } from '../../../../test/database';
import { backupZip, restore } from '../../../../test/restore';

const timestamps = { createdAt: new Date(), updatedAt: new Date() };

/** Restores a backup holding `country` at the given time. */
async function restoreAt(time: string, country = 'France') {
    vi.setSystemTime(new Date(time));
    const response = await restore(
        backupZip((database) => {
            database
                .insert(countries)
                .values({ id: country, name: country, ...timestamps })
                .run();
        })
    );
    const { backup, error } = await response.json();
    return {
        status: response.status,
        backup: backup as string,
        code: error?.code as string,
        error: error?.message as string
    };
}

/** An image the app cannot read: the pre-restore backup fails on it. Returns what undoes it. */
function lockedImage(): () => void {
    const locked = path.join(IMAGES_DIR, 'locked.jpg');
    writeFileSync(locked, 'label bytes');
    chmodSync(locked, 0o000);
    return () => rmSync(locked);
}

const countryNames = async () => (await db.select().from(countries)).map(({ name }) => name);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

it('restores nothing, and keeps an earlier backup, when the current database cannot be backed up', async () => {
    const first = await restoreAt('2026-10-12T10:48:05.000Z', 'France');
    expect(first.status).toBe(200);

    // At the same instant, so that both backups get the same name.
    const unlock = lockedImage();
    try {
        const second = await restoreAt('2026-10-12T10:48:05.000Z', 'Spain');
        expect(second.status).toBe(500);
        expect(second.code).toBe('pre_restore_backup_failed');
        expect(second.error).toMatch(/could not be backed up, so nothing was restored/);
    } finally {
        unlock();
    }

    expect(await countryNames()).toEqual(['France']);
    expect(existsSync(path.join(DATA_DIR, first.backup))).toBe(true);
    // Neither a partial zip nor a snapshot left.
    expect(readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'))).toEqual([
        first.backup
    ]);
});

it('gives each restore its own pre-restore backup, even within a minute', async () => {
    // Restoring the wrong file, then the right one at once: the first backup holds the original.
    const wrong = await restoreAt('2026-10-12T10:49:05.000Z', 'Italy');
    const right = await restoreAt('2026-10-12T10:49:40.000Z', 'Spain');

    expect([wrong.status, right.status]).toEqual([200, 200]);
    expect(right.backup).not.toBe(wrong.backup);
    expect(existsSync(path.join(DATA_DIR, wrong.backup))).toBe(true);
    expect(existsSync(path.join(DATA_DIR, right.backup))).toBe(true);
    // Its name only: the answer does not tell where the server keeps its data.
    expect(wrong.backup).toBe('cellar-backup-pre-restore-2026-10-12T10-49-05-000.zip');
});

it('restores while another program reads the database, and backs up what it held', async () => {
    await restoreAt('2026-10-12T10:50:00.000Z', 'Germany');
    // Like the sqlite3 shell in the middle of a read: the backup no longer has to wait for it.
    const other = openDatabase(DATABASE_PATH).$client;
    other.exec('BEGIN');
    other.prepare('SELECT count(*) FROM countries').get();
    try {
        const { status, backup } = await restoreAt('2026-10-12T10:51:00.000Z', 'Austria');

        expect(status).toBe(200);
        expect(await countryNames()).toEqual(['Austria']);
        const extractDir = path.join(DATA_DIR, 'extracted');
        await extractZip(path.join(DATA_DIR, backup), extractDir, () => true);
        expect(countryNamesInDbFile(path.join(extractDir, 'cellar.db'))).toEqual(['Germany']);
        rmSync(extractDir, { recursive: true });
    } finally {
        other.exec('COMMIT');
        other.close();
    }
});
