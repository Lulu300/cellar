import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { countries } from '#lib/server/db/schema.js';
import { DATA_DIR, IMAGES_DIR } from '#lib/server/paths.js';
import { extractZip, withinExtractionLimits } from '#lib/server/zip.js';
import { fakeEvent } from '../../../../test/event';
import { countryNamesInDbFile } from '../../../../test/database';
import { POST } from './+server';

vi.mock('#lib/server/zip.js', async (importOriginal) => {
    const module = await importOriginal<typeof import('#lib/server/zip.js')>();
    return { ...module, withinExtractionLimits: vi.fn(module.withinExtractionLimits) };
});

const createBackup = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/create-backup',
            routeId: '/api/admin/create-backup',
            body
        })
    );

describe('POST /api/admin/create-backup', () => {
    it('archives the open database with its committed rows, and the images', async () => {
        const now = new Date();
        // In WAL mode, this row stays in cellar.db-wal until a checkpoint.
        await db
            .insert(countries)
            .values({ id: 'fr', name: 'France', createdAt: now, updatedAt: now });
        writeFileSync(path.join(IMAGES_DIR, 'label.jpg'), 'label bytes');

        const response = await createBackup({ name: 'cellar' });

        expect(response.status).toBe(201);
        const answer = await response.json();
        // The file's name only: the answer does not tell where the server keeps its data.
        expect(answer).toEqual({
            success: true,
            message: expect.any(String),
            filename: expect.stringMatching(/^cellar-backup-cellar-.+\.zip$/),
            size: expect.any(Number),
            restorable: true
        });
        const { filename } = answer;
        const extractDir = path.join(DATA_DIR, 'extracted');
        const extracted = await extractZip(path.join(DATA_DIR, filename), extractDir, () => true);
        expect(extracted.sort()).toEqual(['cellar.db', 'images/label.jpg']);
        expect(countryNamesInDbFile(path.join(extractDir, 'cellar.db'))).toEqual(['France']);
    });

    it('refuses a name that retention would take for an automatic backup', async () => {
        const response = await createBackup({ name: 'auto-internal' });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('invalid_file_name');
        expect(readdirSync(DATA_DIR).filter((name) => name.includes('auto-'))).toEqual([]);
    });

    // The files that a backup writes add about 60 bytes to the name, within the 255 of a file name.
    it('takes a name of up to 150 bytes in UTF-8, and refuses a longer one with 422', async () => {
        const before = readdirSync(DATA_DIR);
        const refused = await createBackup({ name: 'é'.repeat(200) });

        expect(refused.status).toBe(422);
        expect((await refused.json()).error.code).toBe('invalid_file_name');
        expect(readdirSync(DATA_DIR)).toEqual(before);
        expect((await createBackup({ name: 'é'.repeat(75) })).status).toBe(201);
    });

    // It holds the data, and can be restored by hand.
    it('writes a backup that a restore would refuse as too large, and says so', async () => {
        vi.mocked(withinExtractionLimits).mockResolvedValueOnce(false);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const response = await createBackup({});

        expect(response.status).toBe(201);
        const { filename, restorable } = await response.json();
        expect(restorable).toBe(false);
        expect(readdirSync(DATA_DIR)).toContain(filename);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(filename));
        warn.mockRestore();
    });
});
