import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '#lib/server/paths.js';
import { filenameFromContentDisposition } from '#lib/utils/content-disposition.js';
import { downloadBackup } from '../../../../test/download';
import { fakeEvent } from '../../../../test/event';
import { GET } from './+server';

describe('GET /api/admin/download-backup', () => {
    it('sends a backup whose name holds characters outside Latin-1 under that name', async () => {
        const filename = 'cellar-backup-Cœur de cave € 🍷-2026-10-11T10-00.zip';
        writeFileSync(path.join(DATA_DIR, filename), 'backup bytes');

        const response = await downloadBackup(filename);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/zip');
        const disposition = response.headers.get('Content-Disposition');
        expect(disposition).toMatch(/^attachment; filename="cellar-backup-C_ur de cave _ _-/);
        expect(filenameFromContentDisposition(disposition)).toBe(filename);
        expect(await response.text()).toBe('backup bytes');
    });

    // `file` was its name before 0.11.0, removed without an alias.
    it('answers 422 to a backup named by `file`', async () => {
        writeFileSync(path.join(DATA_DIR, 'cellar-backup-old-script.zip'), 'backup bytes');

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({
                path: '/api/admin/download-backup?file=cellar-backup-old-script.zip'
            })
        );

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_body',
            details: [{ path: 'filename', message: expect.any(String) }]
        });
    });
});
