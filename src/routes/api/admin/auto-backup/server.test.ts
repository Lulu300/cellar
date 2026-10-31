import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { extractZip } from '#lib/server/zip.js';
import { fakeEvent } from '../../../../test/event';
import { POST } from './+server';

const backUp = () =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/auto-backup',
            routeId: '/api/admin/auto-backup',
            body: {}
        })
    );

describe('POST /api/admin/auto-backup', () => {
    it('backs up nothing unless automatic backups are left to a cron job', async () => {
        setAppSetting('auto_backup_enabled', 'true');
        setAppSetting('auto_backup_mode', 'internal');

        expect((await backUp()).status).toBe(409);
        expect(readdirSync(DATA_DIR).filter((name) => name.endsWith('.zip'))).toEqual([]);
    });

    it('writes a backup and an export of every table', async () => {
        setAppSetting('auto_backup_enabled', 'true');
        setAppSetting('auto_backup_mode', 'cron');

        const response = await backUp();

        expect(response.status).toBe(200);
        const { files } = await response.json();
        expect(files.backup).toMatch(/^cellar-backup-auto-cron-.+\.zip$/);
        const extractDir = path.join(DATA_DIR, 'extracted');
        await extractZip(path.join(DATA_DIR, files.export), extractDir, () => true);
        const { data } = JSON.parse(
            readFileSync(path.join(extractDir, 'cellar-export.json'), 'utf8')
        );
        expect(Object.keys(data)).toEqual([
            'countries',
            'regions',
            'appellations',
            'wineClassifications',
            'wineTypes',
            'wineColors',
            'wineFormats',
            'origins',
            'storageContainers',
            'storageCases',
            'wineImages',
            'wineDefinitions',
            'wineBottles',
            'winePhotos'
        ]);
    });
});
