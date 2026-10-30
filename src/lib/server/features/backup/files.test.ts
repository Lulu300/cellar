import { readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_DIR } from '#lib/server/paths.js';
import { applyRetention, listBackups, manualBackupPath, resolveBackupFile } from './files';

/** Creates the file `name` in DATA_DIR, last modified `daysAgo` days ago. */
function backupFile(name: string, daysAgo: number) {
    const file = path.join(DATA_DIR, name);
    writeFileSync(file, 'zip');
    const time = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    utimesSync(file, time, time);
}

const zips = () =>
    readdirSync(DATA_DIR)
        .filter((name) => name.endsWith('.zip'))
        .sort();

beforeEach(() => {
    for (const name of readdirSync(DATA_DIR)) {
        if (name.startsWith('cellar-')) rmSync(path.join(DATA_DIR, name));
    }
});

describe('backup files', () => {
    it('lists backups and exports newest first, with their type', async () => {
        backupFile('cellar-backup-auto-cron-2026-10-10T10-00-00-000.zip', 2);
        backupFile('cellar-export-auto-internal-2026-10-11T10-00.zip', 1);
        backupFile('cellar-backup-pre-restore-2026-10-09T10-00-00-000.zip', 3);
        backupFile('cellar-backup-pre-reset-2026-10-08T10-00-00-000.zip', 3.5);
        backupFile('cellar-export-pre-import-2026-10-07T10-00-00-000.zip', 3.7);
        backupFile('cellar-export-mine-2026-10-12T10-00-00-000.zip', 0);
        // Named "auto" by the user, before 0.6.0 refused that name: retention never deletes it.
        backupFile('cellar-backup-auto-2025-01-01T10-00.zip', 4);
        // A manual backup whose name holds "-auto-".
        backupFile('cellar-backup-my-auto-thing-2025-01-01T10-00-00-000.zip', 5);
        backupFile('cellar-backup-unfinished.zip.partial', 0);
        backupFile('notes.zip', 0);

        const listed = await listBackups();

        expect(listed.map(({ filename, type }) => [filename, type])).toEqual([
            ['cellar-export-mine-2026-10-12T10-00-00-000.zip', 'manual-export'],
            ['cellar-export-auto-internal-2026-10-11T10-00.zip', 'automatic-export-internal'],
            ['cellar-backup-auto-cron-2026-10-10T10-00-00-000.zip', 'automatic-backup-cron'],
            ['cellar-backup-pre-restore-2026-10-09T10-00-00-000.zip', 'safety-backup-restore'],
            ['cellar-backup-pre-reset-2026-10-08T10-00-00-000.zip', 'safety-backup-reset'],
            ['cellar-export-pre-import-2026-10-07T10-00-00-000.zip', 'safety-export-import'],
            ['cellar-backup-auto-2025-01-01T10-00.zip', 'manual-backup'],
            ['cellar-backup-my-auto-thing-2025-01-01T10-00-00-000.zip', 'manual-backup']
        ]);
    });

    it('keeps the given number of automatic backups, and of automatic exports, apart', async () => {
        for (let day = 1; day <= 4; day++) {
            backupFile(`cellar-backup-auto-internal-2026-09-0${day}T10-00-00-000.zip`, 30 - day);
            backupFile(`cellar-export-auto-cron-2026-09-0${day}T10-00-00-000.zip`, 30 - day);
        }
        backupFile('cellar-backup-auto-cron-2026-10-10T10-00-00-000.zip', 2);
        backupFile('cellar-export-auto-internal-2026-10-11T10-00.zip', 1);
        backupFile('cellar-backup-pre-restore-2026-08-01T10-00-00-000.zip', 60);
        backupFile('cellar-backup-my-auto-thing-2026-08-01T10-00-00-000.zip', 60);
        const before = zips();
        vi.spyOn(console, 'log').mockImplementation(() => {});

        await applyRetention('backup', 2);

        // The cron backup is the newest, then 09-04. Manual and pre-restore backups are not
        // counted.
        const removed = before.filter((name) => !zips().includes(name));
        expect(removed).toEqual([
            'cellar-backup-auto-internal-2026-09-01T10-00-00-000.zip',
            'cellar-backup-auto-internal-2026-09-02T10-00-00-000.zip',
            'cellar-backup-auto-internal-2026-09-03T10-00-00-000.zip'
        ]);

        await applyRetention('export', 3);
        expect(zips().filter((name) => name.startsWith('cellar-export-auto-'))).toEqual([
            'cellar-export-auto-cron-2026-09-03T10-00-00-000.zip',
            'cellar-export-auto-cron-2026-09-04T10-00-00-000.zip',
            'cellar-export-auto-internal-2026-10-11T10-00.zip'
        ]);
    });

    it.each(['auto-internal', 'auto-cron', 'auto'])(
        'keeps names starting with auto- for automatic files: refuses %s',
        (name) => {
            expect(manualBackupPath('backup', name, '2026-10-12T10-00-00-000')).toBeNull();
            expect(manualBackupPath('export', name, '2026-10-12T10-00-00-000')).toBeNull();
        }
    );

    it('names a manual backup after its custom name, or after the date alone', () => {
        const timestamp = '2026-10-12T10-00-00-000';
        expect(manualBackupPath('backup', 'automne', timestamp)).toBe(
            path.resolve(DATA_DIR, `cellar-backup-automne-${timestamp}.zip`)
        );
        expect(manualBackupPath('export', undefined, timestamp)).toBe(
            path.resolve(DATA_DIR, `cellar-export-${timestamp}.zip`)
        );
        expect(manualBackupPath('backup', '../outside', timestamp)).toBeNull();
    });
});

describe('resolveBackupFile', () => {
    it('accepts backups and exports only', () => {
        expect(resolveBackupFile('cellar-backup-2026-10-10.zip')).toBe(
            path.resolve(DATA_DIR, 'cellar-backup-2026-10-10.zip')
        );
        expect(resolveBackupFile('cellar-export-2026-10-10.zip')).not.toBeNull();
        // The CSV export is no longer written in DATA_DIR.
        expect(resolveBackupFile('cellar-export-countries-2026-10-10.csv')).toBeNull();
        expect(resolveBackupFile('cellar.db')).toBeNull();
        // Still being written, or interrupted.
        expect(resolveBackupFile('cellar-backup-2026-10-10.zip.partial')).toBeNull();
        expect(resolveBackupFile('cellar-backup-/../cellar.db')).toBeNull();
    });
});
