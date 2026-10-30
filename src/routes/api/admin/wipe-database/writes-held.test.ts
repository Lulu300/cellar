import { describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { createBackupZip } from '#lib/server/features/backup/archive.js';
import { holdWrites, runWrite } from '#lib/server/write-gate.js';
import { fakeEvent } from '../../../../test/event';
import { POST } from './+server';

vi.mock('#lib/server/features/backup/archive.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/features/backup/archive.js')>();
    return { ...module, createBackupZip: vi.fn(module.createBackupZip) };
});

const wipe = () =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/wipe-database',
            routeId: '/api/admin/wipe-database'
        })
    );

const write = () => runWrite(async () => new Response('written'));

const countryNames = () =>
    db
        .select()
        .from(countries)
        .all()
        .map(({ name }) => name);

describe('POST /api/admin/wipe-database and the other writes', () => {
    it('answers 503 while a restore holds the writes, and changes nothing', async () => {
        const now = new Date();
        db.insert(countries)
            .values({ id: 'atlantis', name: 'Atlantis', createdAt: now, updatedAt: now })
            .run();
        const response = await holdWrites(async () => wipe());

        expect(response.status).toBe(503);
        expect((await response.json()).error.code).toBe('writes_held');
        expect(countryNames()).toContain('Atlantis');
    });

    // Otherwise the write would be in neither the pre-reset backup nor the database.
    it('refuses other writes from its backup to the end of the wipe, then lets them in', async () => {
        let backupStarted!: () => void;
        const backingUp = new Promise<void>((resolve) => (backupStarted = resolve));
        let finishBackup!: () => void;
        const backupDone = new Promise<void>((resolve) => (finishBackup = resolve));
        const { createBackupZip: actual } = await vi.importActual<
            typeof import('#lib/server/features/backup/archive.js')
        >('#lib/server/features/backup/archive.js');
        vi.mocked(createBackupZip).mockImplementationOnce(async (...args) => {
            backupStarted();
            await backupDone;
            return actual(...args);
        });

        const wiping = wipe();
        await backingUp;
        const refused = await write();
        finishBackup();

        expect((await wiping).status).toBe(200);
        expect(refused.status).toBe(503);
        expect((await refused.json()).error.code).toBe('writes_held');
        expect((await write()).status).toBe(200);
    });
});
