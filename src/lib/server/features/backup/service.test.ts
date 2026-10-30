import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { appSettings, countries } from '#lib/server/db/schema.js';
import { DATA_DIR } from '#lib/server/paths.js';
import type { ZipSource } from '#lib/server/http/body.js';
import { holdWrites, runWrite } from '#lib/server/write-gate.js';
import { failWrites } from '../../../../test/failing-write';
import { createExportZip } from './export';
import { importJson } from './json-import';
import { copyBackupImages } from './restore';
import { getBackupSettings } from './scheduler';
import { createManualExport, openBackupFile, saveBackupSettings } from './service';

vi.mock('./export', async (importOriginal) => {
    const module = await importOriginal<typeof import('./export')>();
    return { ...module, createExportZip: vi.fn(module.createExportZip) };
});

vi.mock('./restore', async (importOriginal) => {
    const module = await importOriginal<typeof import('./restore')>();
    return { ...module, copyBackupImages: vi.fn(module.copyBackupImages) };
});

vi.mock('./scheduler', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./scheduler')>()),
    reschedule: vi.fn()
}));

beforeEach(() => {
    db.delete(countries).run();
    db.delete(appSettings).run();
});

const countryNames = () =>
    db
        .select()
        .from(countries)
        .all()
        .map(({ name }) => name);

function addCountry(name: string) {
    const now = new Date();
    db.insert(countries).values({ id: name, name, createdAt: now, updatedAt: now }).run();
}

/** An export of the current data, as the admin page sends it. */
async function exportFile(): Promise<ZipSource> {
    const { file } = await createManualExport(undefined);
    const zipPath = path.join(DATA_DIR, file.filename);
    const zip = readFileSync(zipPath);
    rmSync(zipPath);
    return { upload: new Blob([new Uint8Array(zip)]).stream() };
}

const write = () => runWrite(async () => new Response('written'));

describe('importJson', () => {
    it('refuses other writes from its backup to the end of the import, then lets them in', async () => {
        addCountry('France');
        const file = await exportFile();
        let backupStarted!: () => void;
        const backingUp = new Promise<void>((resolve) => (backupStarted = resolve));
        let finishBackup!: () => void;
        const backupDone = new Promise<void>((resolve) => (finishBackup = resolve));
        const { createExportZip: actual } =
            await vi.importActual<typeof import('./export')>('./export');
        vi.mocked(createExportZip).mockImplementationOnce(async (...args) => {
            backupStarted();
            await backupDone;
            return actual(...args);
        });

        const importing = importJson(file);
        await backingUp;
        const refused = await write();
        finishBackup();
        const imported = await importing;

        expect(refused.status).toBe(503);
        expect((await refused.json()).error.code).toBe('writes_held');
        expect(imported.success).toBe(true);
        expect((await write()).status).toBe(200);
        expect(countryNames()).toEqual(['France']);
    });

    it('copies its images before it lets the other writes in', async () => {
        const file = await exportFile();
        let statusDuringCopy: number | undefined;
        const { copyBackupImages: actual } =
            await vi.importActual<typeof import('./restore')>('./restore');
        vi.mocked(copyBackupImages).mockImplementationOnce(async (...args) => {
            statusDuringCopy = (await write()).status;
            return actual(...args);
        });

        await importJson(file);

        expect(statusDuringCopy).toBe(503);
        expect((await write()).status).toBe(200);
    });

    it('answers 503 while a restore holds the writes, and changes nothing', async () => {
        addCountry('France');
        const file = await exportFile();
        addCountry('Italy');

        await expect(holdWrites(() => importJson(file))).rejects.toMatchObject({
            status: 503,
            code: 'writes_held'
        });
        expect(countryNames().sort()).toEqual(['France', 'Italy']);
    });
});

describe('openBackupFile', () => {
    it('streams the file instead of reading it whole', async () => {
        const name = 'cellar-backup-streamed.zip';
        writeFileSync(path.join(DATA_DIR, name), 'backup bytes');

        const file = await openBackupFile(name);

        expect(file).toMatchObject({ filename: name, contentType: 'application/zip', size: 12 });
        expect(file.body).toBeInstanceOf(ReadableStream);
        expect(await new Response(file.body).text()).toBe('backup bytes');
    });

    it('refuses a name that is not a backup, and a backup that does not exist', async () => {
        await expect(openBackupFile('cellar.db')).rejects.toMatchObject({ status: 422 });
        // A path, as the answers gave before 0.7.0
        writeFileSync(path.join(DATA_DIR, 'cellar-backup-path.zip'), 'backup bytes');
        await expect(openBackupFile(`${DATA_DIR}/cellar-backup-path.zip`)).rejects.toMatchObject({
            status: 422
        });
        await expect(openBackupFile('cellar-backup-gone.zip')).rejects.toMatchObject({
            status: 404
        });
    });
});

describe('saveBackupSettings', () => {
    const settings = { autoBackupEnabled: true, autoBackupInterval: 12, autoBackupKeepCount: 3 };

    it('saves every setting, or none', () => {
        failWrites('INSERT', 'app_settings', "NEW.key = 'auto_backup_keep_count'");

        expect(() => saveBackupSettings(settings)).toThrow();
        expect(db.select().from(appSettings).all()).toEqual([]);
    });

    it('keeps the stored mode when the request has none', () => {
        saveBackupSettings({ ...settings, autoBackupMode: 'cron' });
        saveBackupSettings(settings);

        expect(getBackupSettings()).toMatchObject({
            enabled: true,
            intervalHours: 12,
            mode: 'cron'
        });
    });
});
