import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import {
    appSettings,
    countries,
    csvImportChoices,
    wineBottles,
    wineDefinitions,
    wineFormats,
    wineTypes
} from '#lib/server/db/schema.js';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { getAppSetting, setAppSetting } from '#lib/server/features/settings/repository.js';
import { getNextBarcodeNumber } from '#lib/server/features/barcode/service.js';
import { IMAGES_DIR } from '#lib/server/paths.js';
import { fakeEvent } from '../../../../test/event';
import { failWrites } from '../../../../test/failing-write';
import { insertImageRow, jpegBytes } from '../../../../test/image';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import { POST } from './+server';

const wipe = () =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/wipe-database',
            routeId: '/api/admin/wipe-database'
        })
    );

async function snapshot() {
    return {
        countries: await db.select().from(countries),
        wineTypes: await db.select().from(wineTypes),
        wineDefinitions: await db.select().from(wineDefinitions),
        appSettings: await db.select().from(appSettings)
    };
}

describe('POST /api/admin/wipe-database', () => {
    beforeEach(async () => {
        if ((await db.select().from(wineDefinitions)).length === 0) await insertWineDefinition();
        setAppSetting('initial_seeding_completed', 'true');
        setAppSetting('barcode_prefix', 'KEPT');
    });

    it('changes nothing when the default data cannot be inserted again', async () => {
        const before = await snapshot();
        failWrites('INSERT', 'wine_types', "NEW.type = 'Champagne'");

        const response = await wipe();

        expect(response.status).toBe(500);
        expect((await response.clone().json()).error.details).toMatchObject({
            files: expect.stringMatching(/csv-imports\/wine_types\.csv$/),
            // The copy in CSV_IMPORTS_DIR failed: the user can fix or delete it.
            fixable: true,
            folder: expect.stringMatching(/csv-imports$/)
        });
        expect((await response.json()).error.message).toMatch(
            /^Nothing was changed\. .*wine_types\.csv/
        );
        expect(await snapshot()).toEqual(before);
    });

    it('removes the cellar and its image files, keeps the settings and inserts the default data again', async () => {
        mkdirSync(IMAGES_DIR, { recursive: true });
        await insertImageRow('label', 'label.jpg');
        writeFileSync(path.join(IMAGES_DIR, 'label.jpg'), jpegBytes('label'));
        // Left by an older version, which never deleted the files.
        writeFileSync(path.join(IMAGES_DIR, 'stray.jpg'), jpegBytes('stray'));
        setAppSetting('barcode_auto_generation', 'true');
        const [definition] = await db.select().from(wineDefinitions);
        const [format] = await db.select().from(wineFormats);
        createBottles(bottleData(definition.id, { formatId: format.id }), 3);

        const response = await wipe();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            backup: expect.stringMatching(/^cellar-backup-pre-reset-.+\.zip$/)
        });
        expect(await db.select().from(wineDefinitions)).toEqual([]);
        expect(await db.select().from(wineBottles)).toEqual([]);
        // The pre-reset backup holds them.
        expect(readdirSync(IMAGES_DIR)).toEqual([]);
        expect((await db.select().from(wineTypes)).map((type) => type.type)).toContain('Champagne');
        expect((await getAppSetting('barcode_prefix'))?.value).toBe('KEPT');
        expect((await getAppSetting('initial_seeding_completed'))?.value).toBe('true');
        // Their labels may still be on bottles: the numbering goes on after the last one given.
        expect(getAppSetting('barcode_last_number:KEPT')?.value).toBe('3');
        expect(getNextBarcodeNumber({ prefix: 'KEPT', startNumber: 1 })).toBe(4);
    });
});

describe('POST /api/admin/wipe-database and the CSV imports', () => {
    it('forgets the choices of the reviews, which name rows of the cellar', async () => {
        await db.insert(csvImportChoices).values({ key: 'k', answer: '{"id":"x"}' });

        expect((await wipe()).status).toBe(200);

        expect(await db.select().from(csvImportChoices)).toEqual([]);
    });
});
