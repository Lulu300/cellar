import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { DELETE } from './+server';

const deleteBackup = (body: unknown) =>
    DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            path: '/api/admin/delete-backup',
            routeId: '/api/admin/delete-backup',
            body
        })
    );

describe('DELETE /api/admin/delete-backup', () => {
    it('deletes the backup file and answers 204', async () => {
        const filename = 'cellar-backup-2026-10-01T10-00-00-000.zip';
        writeFileSync(path.join(DATA_DIR, filename), 'zip bytes');

        const response = await deleteBackup({ filename });

        expect(response.status).toBe(204);
        expect(existsSync(path.join(DATA_DIR, filename))).toBe(false);
    });

    it('answers 404 for a backup name that has no file', async () => {
        const response = await deleteBackup({
            filename: 'cellar-export-2026-10-01T10-00-00-000.zip'
        });

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });

    it.each([
        ['the database', 'cellar.db'],
        ['a path out of the data folder', '../cellar-backup-x.zip'],
        ['a zip still being written', 'cellar-backup-x.zip.partial']
    ])('answers 422 for %s, and deletes nothing', async (_case, filename) => {
        const response = await deleteBackup({ filename });

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_body',
            details: [{ path: 'filename', message: expect.any(String) }]
        });
        expect(existsSync(path.join(DATA_DIR, 'cellar.db'))).toBe(true);
    });
});
