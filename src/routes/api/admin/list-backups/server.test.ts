import { utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { GET } from './+server';

/** Writes `name` in DATA_DIR, dated `date`. */
function writeDataFile(name: string, date: string) {
    const file = path.join(DATA_DIR, name);
    writeFileSync(file, 'zip bytes');
    utimesSync(file, new Date(date), new Date(date));
}

describe('GET /api/admin/list-backups', () => {
    it('lists the backups and exports, newest first, and no other file', async () => {
        writeDataFile('cellar-backup-before-move-2026-10-01T10-00-00-000.zip', '2026-10-01');
        writeDataFile('cellar-export-auto-cron-2026-10-03T10-00-00-000.zip', '2026-10-03');
        writeDataFile('cellar-backup-auto-internal-2026-10-02T10-00-00-000.zip', '2026-10-02');
        writeDataFile('cellar-backup-2026-10-04T10-00-00-000.zip.partial', '2026-10-04');
        writeDataFile('notes.zip', '2026-10-04');

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/admin/list-backups' })
        );

        expect(response.status).toBe(200);
        expect((await response.json()).backups).toEqual([
            {
                filename: 'cellar-export-auto-cron-2026-10-03T10-00-00-000.zip',
                size: 9,
                created: '2026-10-03T00:00:00.000Z',
                type: 'automatic-export-cron',
                isDatabase: false,
                isAutomatic: true,
                isExport: true,
                isZip: true
            },
            {
                filename: 'cellar-backup-auto-internal-2026-10-02T10-00-00-000.zip',
                size: 9,
                created: '2026-10-02T00:00:00.000Z',
                type: 'automatic-backup-internal',
                isDatabase: true,
                isAutomatic: true,
                isExport: false,
                isZip: true
            },
            {
                filename: 'cellar-backup-before-move-2026-10-01T10-00-00-000.zip',
                size: 9,
                created: '2026-10-01T00:00:00.000Z',
                type: 'manual-backup',
                isDatabase: true,
                isAutomatic: false,
                isExport: false,
                isZip: true
            }
        ]);
    });
});
