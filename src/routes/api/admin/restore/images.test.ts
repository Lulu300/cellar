import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { wineImages } from '#lib/server/db/schema.js';
import type { Db } from '#lib/server/db/connection.js';
import { copyBackupImages } from '#lib/server/features/backup/restore.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { runWrite } from '#lib/server/write-gate.js';
import { insertImageRow, jpegBytes } from '../../../../test/image';
import { backupZip, restore } from '../../../../test/restore';

vi.mock('#lib/server/features/backup/restore.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/features/backup/restore.js')>();
    return { ...module, copyBackupImages: vi.fn(module.copyBackupImages) };
});

const write = () => runWrite(async () => new Response('written'));

function insertImageRows(database: Db, filenames: string[]): void {
    const now = new Date();
    for (const filename of filenames) {
        database
            .insert(wineImages)
            .values({ id: filename, filename, createdAt: now, updatedAt: now })
            .run();
    }
}

describe('POST /api/admin/restore and the image files', () => {
    it('copies the images of the backup before it lets the other writes in', async () => {
        let statusDuringCopy: number | undefined;
        const { copyBackupImages: actual } = await vi.importActual<
            typeof import('#lib/server/features/backup/restore.js')
        >('#lib/server/features/backup/restore.js');
        vi.mocked(copyBackupImages).mockImplementationOnce(async (...args) => {
            statusDuringCopy = (await write()).status;
            return actual(...args);
        });
        const file = backupZip((backup) => insertImageRows(backup, ['label.jpg']), {
            extraEntries: [{ name: 'images/label.jpg', data: jpegBytes('label') }]
        });

        expect((await restore(file)).status).toBe(200);

        expect(statusDuringCopy).toBe(503);
        expect((await write()).status).toBe(200);
    });

    it('deletes the image files that no row of the restored database cites', async () => {
        mkdirSync(IMAGES_DIR, { recursive: true });
        // Cited by both databases, and only on the disk: the restore keeps it.
        await insertImageRow('kept', 'kept.jpg');
        writeFileSync(path.join(IMAGES_DIR, 'kept.jpg'), jpegBytes('kept'));
        // Cited by the replaced database only.
        await insertImageRow('replaced', 'replaced.jpg');
        writeFileSync(path.join(IMAGES_DIR, 'replaced.jpg'), jpegBytes('replaced'));
        // Not an image of the app: left alone.
        writeFileSync(path.join(IMAGES_DIR, '.DS_Store'), 'Finder');
        const file = backupZip((backup) => insertImageRows(backup, ['kept.jpg', 'label.jpg']), {
            extraEntries: [
                { name: 'images/label.jpg', data: jpegBytes('label') },
                // In the backup's folder, but cited by none of its rows.
                { name: 'images/stray.jpg', data: jpegBytes('stray') }
            ]
        });

        expect((await restore(file)).status).toBe(200);

        expect(readdirSync(IMAGES_DIR).sort()).toEqual(['.DS_Store', 'kept.jpg', 'label.jpg']);
    });
});
