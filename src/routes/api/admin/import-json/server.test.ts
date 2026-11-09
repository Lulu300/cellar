import {
    chmodSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    origins,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineImages,
    winePhotos,
    wineTypes,
    wishes
} from '#lib/server/db/schema.js';
import { backupTimestamp } from '#lib/server/features/backup/archive.js';
import { listWinePhotos } from '#lib/server/features/images/service.js';
import { storageOverview } from '#lib/server/features/storage/service.js';
import { DATA_DIR, IMAGES_DIR, IMAGES_URL_PATH } from '#lib/server/paths.js';
import { NEUTRAL_HEX, startingHex } from '#lib/shared/wine-colors.js';
import { fakeEvent } from '../../../../test/event';
import { failWrites } from '../../../../test/failing-write';
import { insertWineDefinition } from '../../../../test/wine';
import { buildZip } from '../../../../test/zip';
import { jpegBytes } from '../../../../test/image';
import { POST as createExport } from '../create-export/+server';
import { POST } from './+server';

// Parents first, as an export lists them.
const TABLES = {
    countries,
    regions,
    appellations,
    wineClassifications,
    wineTypes,
    wineColors,
    wineFormats,
    origins,
    storageContainers,
    storageCases,
    wineImages,
    wineDefinitions,
    wineBottles,
    winePhotos,
    wishes
};

async function snapshot() {
    const rows: Record<string, unknown[]> = {};
    for (const [name, table] of Object.entries(TABLES)) rows[name] = await db.select().from(table);
    return rows;
}

const now = new Date();
const timestamps = { createdAt: now, updatedAt: now };

beforeEach(async () => {
    for (const table of Object.values(TABLES).reverse()) await db.delete(table);
    for (const name of readdirSync(IMAGES_DIR)) {
        rmSync(path.join(IMAGES_DIR, name), { recursive: true });
    }
    for (const name of readdirSync(DATA_DIR)) {
        if (!name.startsWith('cellar.db')) rmSync(path.join(DATA_DIR, name), { recursive: true });
    }

    const definitionId = await insertWineDefinition();
    await db.insert(wineImages).values({
        id: 'label',
        filename: 'label.jpg',
        path: IMAGES_URL_PATH,
        ...timestamps
    });
    writeFileSync(path.join(IMAGES_DIR, 'label.jpg'), jpegBytes('label bytes'));
    await db
        .update(wineDefinitions)
        .set({ imageId: 'label' })
        .where(eq(wineDefinitions.id, definitionId));
    // Another photo of the wine
    await db.insert(wineImages).values({
        id: 'back',
        filename: 'back.jpg',
        path: IMAGES_URL_PATH,
        ...timestamps
    });
    writeFileSync(path.join(IMAGES_DIR, 'back.jpg'), jpegBytes('back label bytes'));
    await db
        .insert(winePhotos)
        .values({ id: 'photo', definitionId, imageId: 'back', createdAt: now });
    // The wishlist: the wine, and a text with the photo of its label
    await db.insert(wineImages).values({
        id: 'wish-label',
        filename: 'wish-label.jpg',
        path: IMAGES_URL_PATH,
        ...timestamps
    });
    writeFileSync(path.join(IMAGES_DIR, 'wish-label.jpg'), jpegBytes('wish label bytes'));
    await db.insert(wishes).values([
        { id: 'again', definitionId, quantity: 6, note: 'For the cellar', ...timestamps },
        { id: 'idea', text: 'Clos Rougeard', imageId: 'wish-label', ...timestamps }
    ]);
    await db.insert(storageContainers).values({ id: 'rack', name: 'Rack', ...timestamps });
    await db
        .insert(storageCases)
        .values({ id: 'rack1', name: 'Rack1', capacity: 6, containerId: 'rack', ...timestamps });
    await db.insert(wineBottles).values({
        id: 'b1',
        definitionId,
        formatId: 'bottle',
        storageCaseId: 'rack1',
        barcode: 'WINE000001',
        purchaseDate: new Date('2024-05-01T00:00:00Z'),
        optimum: 2030,
        drinkFrom: '2026-09',
        drinkBefore: '2027-03',
        ...timestamps
    });
});

/** The zip that POST /api/admin/create-export writes for the current data. */
async function exportZip(): Promise<Buffer> {
    const response = await createExport(
        fakeEvent<Parameters<typeof createExport>[0]>({
            method: 'POST',
            path: '/api/admin/create-export',
            routeId: '/api/admin/create-export',
            body: {}
        })
    );
    expect(response.status).toBe(201);
    const zipPath = path.join(DATA_DIR, (await response.json()).files.zip.filename);
    const zip = readFileSync(zipPath);
    rmSync(zipPath);
    return zip;
}

/** The names of the cases of the container Rack, in the order the storage page shows them. */
const caseNames = () =>
    storageOverview()
        .find(({ id }) => id === 'rack')!
        .cases.map(({ name }) => name);

/** An export zip holding `data` as its JSON, and the image new.jpg. */
function craftedZip(data: Record<string, unknown>): Buffer {
    const json = { exportedAt: now.toISOString(), version: '1.0', data };
    return buildZip([
        { name: 'cellar-export.json', data: Buffer.from(JSON.stringify(json)) },
        { name: 'images/new.jpg', data: jpegBytes('new bytes') }
    ]);
}

/** Imports `body`: a zip sent as is, or the name of an export of the list. */
function importRequest(body: File | FormData | { filename: string }) {
    return POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/import-json',
            routeId: '/api/admin/import-json',
            body
        })
    );
}

const zipFile = (zip: Buffer) =>
    new File([new Uint8Array(zip)], 'cellar-export.zip', { type: 'application/zip' });

const importZip = (zip: Buffer) => importRequest(zipFile(zip));

/** The files in DATA_DIR besides the database. */
function dataFiles() {
    return readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'));
}

describe('POST /api/admin/import-json', () => {
    it('answers 400 to the form that older versions sent, and changes nothing', async () => {
        const before = await snapshot();
        const form = new FormData();
        form.append('file', zipFile(await exportZip()));

        const response = await importRequest(form);

        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('malformed_body');
        expect(await snapshot()).toEqual(before);
    });

    it('imports an export of the list by its name, and leaves it in the list', async () => {
        const exported = await snapshot();
        const name = 'cellar-export-listed.zip';
        const zip = await exportZip();
        writeFileSync(path.join(DATA_DIR, name), zip);
        await db.delete(wineBottles);

        const response = await importRequest({ filename: name });

        expect(response.status).toBe(200);
        expect(await snapshot()).toEqual(exported);
        expect(readFileSync(path.join(DATA_DIR, name))).toEqual(zip);
        expect(dataFiles().filter((file) => file.startsWith('temp-'))).toEqual([]);
    });

    it('keeps a damaged export of the list that it refuses to import, and changes nothing', async () => {
        const before = await snapshot();
        const name = 'cellar-export-damaged.zip';
        writeFileSync(path.join(DATA_DIR, name), 'not a zip');

        const response = await importRequest({ filename: name });

        expect(response.status).toBe(422);
        expect(await snapshot()).toEqual(before);
        expect(readFileSync(path.join(DATA_DIR, name), 'utf8')).toBe('not a zip');
        expect(dataFiles()).toEqual([name]);
    });

    // A disk error is the server's, not the file's: no 422 that would blame the export.
    it.each([
        ['create its folder', () => DATA_DIR],
        [
            'write the files it extracts',
            () => {
                // The folder of the extraction, which the import names after the time.
                vi.useFakeTimers({ toFake: ['Date'] });
                vi.setSystemTime(new Date('2026-10-23T10:00:00.000Z'));
                const folder = path.join(DATA_DIR, `temp-extract-import-${backupTimestamp()}`);
                mkdirSync(folder);
                return folder;
            }
        ]
    ])('answers 500 when the server cannot %s, and changes nothing', async (_, blockedFolder) => {
        const before = await snapshot();
        const name = 'cellar-export-listed.zip';
        writeFileSync(path.join(DATA_DIR, name), await exportZip());
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        let folder: string | undefined;
        let response: Response;
        try {
            folder = blockedFolder();
            chmodSync(folder, 0o555);
            response = await importRequest({ filename: name });
        } finally {
            // The import removes the folder of its extraction, read-only or not.
            if (folder && existsSync(folder)) chmodSync(folder, 0o755);
            consoleError.mockRestore();
            vi.useRealTimers();
        }

        expect(response.status).toBe(500);
        expect((await response.json()).error).toEqual({
            code: 'internal_error',
            message: 'Internal server error'
        });
        expect(await snapshot()).toEqual(before);
    });

    it('answers 422 for a zip whose JSON cannot be read', async () => {
        const response = await importZip(
            buildZip([{ name: 'cellar-export.json', data: Buffer.from('{ not JSON') }])
        );

        expect(response.status).toBe(422);
        expect((await response.json()).error.details.problem).toBe('unreadable');
    });

    it('puts back the data and the images of a full export', async () => {
        const exported = await snapshot();
        const zip = await exportZip();
        await db.delete(wineBottles);
        await db.insert(countries).values({ id: 'it', name: 'Italy', ...timestamps });
        rmSync(path.join(IMAGES_DIR, 'label.jpg'));

        const response = await importZip(zip);

        expect(response.status).toBe(200);
        expect(await snapshot()).toEqual(exported);
        expect(readFileSync(path.join(IMAGES_DIR, 'label.jpg'))).toEqual(jpegBytes('label bytes'));
        expect(readFileSync(path.join(IMAGES_DIR, 'wish-label.jpg'))).toEqual(
            jpegBytes('wish label bytes')
        );
        // To the millisecond, so that two imports in the same minute keep both backups.
        expect(dataFiles()).toEqual([
            expect.stringMatching(
                /^cellar-export-pre-import-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}\.zip$/
            )
        ]);
        // Its bare name, which the admin dialogs pass to download-backup.
        expect((await response.json()).backup).toBe(dataFiles()[0]);
    });

    // FEAT-12: a drunk bottle keeps the case it was in, where putting it back returns it.
    it('puts back the case that a drunk bottle kept, without counting it there', async () => {
        await db.insert(wineBottles).values({
            id: 'drunk',
            definitionId: 'margaux',
            formatId: 'bottle',
            storageCaseId: 'rack1',
            availability: 'consumed',
            consumedDate: new Date('2026-10-30T00:00:00Z'),
            ...timestamps
        });
        const zip = await exportZip();
        await db.delete(wineBottles);

        expect((await importZip(zip)).status).toBe(200);

        const [drunk] = await db.select().from(wineBottles).where(eq(wineBottles.id, 'drunk'));
        expect(drunk).toMatchObject({ availability: 'consumed', storageCaseId: 'rack1' });
        expect(storageOverview()[0].cases[0].bottles).toBe(1);
    });

    it('imports an export made before wines had other photos and a wishlist', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        delete data.winePhotos;
        delete data.wishes;

        expect((await importZip(craftedZip(data))).status).toBe(200);

        expect(await db.select().from(winePhotos)).toEqual([]);
        expect(await db.select().from(wishes)).toEqual([]);
        expect(await db.select({ imageId: wineDefinitions.imageId }).from(wineDefinitions)).toEqual(
            [{ imageId: 'label' }]
        );
    });

    // FEAT-19: the drinking window start came in 1.6.0.
    it('imports an export made before bottles had a window start, with none', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        delete data.wineBottles[0].drinkFrom;

        expect((await importZip(craftedZip(data))).status).toBe(200);

        expect(await db.select().from(wineBottles)).toEqual([
            expect.objectContaining({
                id: 'b1',
                drinkFrom: null,
                drinkBefore: '2027-03',
                optimum: 2030
            })
        ]);
    });

    it('refuses a bottle whose window ends before it starts, as the bottle routes do', async () => {
        const before = await snapshot();
        const data = JSON.parse(JSON.stringify(before));
        data.wineBottles[0].drinkFrom = '2027-04';

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_export',
            details: {
                problem: 'invalid_row',
                table: 'wineBottles',
                row: 1,
                problems: [{ code: 'invalid', column: 'drinkFrom' }]
            }
        });
        expect(await snapshot()).toEqual(before);
    });

    it('gives a wine of a hand-made export its main photo once, among its photos', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        // The main photo repeated among the others
        data.winePhotos.push({ ...data.winePhotos[0], id: 'again', imageId: 'label' });

        expect((await importZip(craftedZip(data))).status).toBe(200);

        expect(listWinePhotos('margaux').map(({ imageId }) => imageId)).toEqual(['label', 'back']);
    });

    it('gives a wine of a hand-made export that has photos but no main one its first photo', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        data.wineDefinitions[0].imageId = null;

        expect((await importZip(craftedZip(data))).status).toBe(200);

        expect(listWinePhotos('margaux')).toMatchObject([{ imageId: 'back', main: true }]);
    });

    it('keeps the order of the cases', async () => {
        await db.insert(storageCases).values([
            { id: 'rack10', name: 'Rack10', capacity: 6, containerId: 'rack', ...timestamps },
            { id: 'rack2', name: 'Rack2', capacity: 6, containerId: 'rack', ...timestamps }
        ]);
        await db.update(storageCases).set({ position: 2 }).where(eq(storageCases.id, 'rack1'));
        await db.update(storageCases).set({ position: 1 }).where(eq(storageCases.id, 'rack2'));
        const zip = await exportZip();

        expect((await importZip(zip)).status).toBe(200);

        expect(caseNames()).toEqual(['Rack10', 'Rack2', 'Rack1']);
    });

    // Its cases have no position: they keep the order that 0.7.0 showed.
    it('orders the cases of an export from 0.7.0 as that version did', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        const [rack1] = data.storageCases;
        delete rack1.position;
        data.storageCases = [
            { ...rack1, id: 'rack10', name: 'Rack10' },
            rack1,
            { ...rack1, id: 'rack2', name: 'Rack2' }
        ];

        expect((await importZip(craftedZip(data))).status).toBe(200);

        expect(caseNames()).toEqual(['Rack1', 'Rack2', 'Rack10']);
    });

    it('imports nothing when the current data cannot be backed up first', async () => {
        const before = await snapshot();
        // An image the app cannot read makes the backup fail.
        const locked = path.join(IMAGES_DIR, 'locked.jpg');
        writeFileSync(locked, 'label bytes');
        chmodSync(locked, 0o000);
        try {
            const response = await importZip(craftedZip(JSON.parse(JSON.stringify(before))));

            expect(response.status).toBe(500);
            expect((await response.json()).error.code).toBe('pre_import_backup_failed');
        } finally {
            chmodSync(locked, 0o644);
        }
        expect(await snapshot()).toEqual(before);
        expect(existsSync(path.join(IMAGES_DIR, 'new.jpg'))).toBe(false);
        expect(dataFiles()).toEqual([]);
    });

    // 0.5.0 stored them: a blank barcode on several bottles, a status in capitals, a rating of 0,
    // the name of a container where the id of a parent was expected.
    it('imports the values of an older export that stand for valid ones', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        const [bottle] = data.wineBottles;
        data.wineBottles = [
            { ...bottle, barcode: '', availability: 'Available' },
            { ...bottle, id: 'b2', barcode: ' ', availability: '' }
        ];
        data.wineDefinitions[0].rating = 0;
        data.storageContainers.push({
            ...data.storageContainers[0],
            id: 'box',
            name: 'Box',
            parentContainerId: 'Rack'
        });

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(200);
        const bottles = await db.select().from(wineBottles);
        expect(bottles.map(({ barcode, availability }) => ({ barcode, availability }))).toEqual([
            { barcode: null, availability: 'available' },
            { barcode: null, availability: 'available' }
        ]);
        expect((await db.select().from(wineDefinitions))[0].rating).toBeNull();
        const box = await db
            .select()
            .from(storageContainers)
            .where(eq(storageContainers.id, 'box'));
        expect(box[0].parentContainerId).toBeNull();
    });

    // As migration 0006 repairs a database: nothing the user entered is lost.
    it('repairs the values of an older export that the API refuses, as the upgrade does', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        data.wineDefinitions[0].rating = 7;
        data.wineDefinitions[0].grapeVarieties = null;
        data.wineDefinitions.push(
            { ...data.wineDefinitions[0], id: 'half', rating: 4.5, grapeVarieties: 'Syrah' },
            { ...data.wineDefinitions[0], id: 'number', rating: null, grapeVarieties: 5 },
            {
                ...data.wineDefinitions[0],
                id: 'target',
                rating: null,
                grapeVarieties: ['Merlot', ' ', 0],
                targetQuantity: 2.5
            }
        );
        data.wineBottles[0].availability = ' Lost ';

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(200);
        const wines = await db.select().from(wineDefinitions);
        expect(
            wines.map(({ rating, grapeVarieties, targetQuantity, description }) => ({
                rating,
                grapeVarieties,
                targetQuantity,
                description
            }))
        ).toEqual([
            {
                rating: null,
                grapeVarieties: [],
                targetQuantity: null,
                description: 'Rating 7 removed in the import: ratings go from 1 to 5.'
            },
            { rating: 4.5, grapeVarieties: ['Syrah'], targetQuantity: null, description: null },
            { rating: null, grapeVarieties: ['5'], targetQuantity: null, description: null },
            {
                rating: null,
                grapeVarieties: ['Merlot', '0'],
                targetQuantity: null,
                description:
                    'Target quantity 2.5 removed in the import: it is a whole number from 0 to 10000.'
            }
        ]);
        expect(await db.select().from(wineBottles)).toEqual([
            expect.objectContaining({
                availability: 'out_of_cellar',
                notes: 'Status " Lost " replaced by "out_of_cellar" in the import.'
            })
        ]);
    });

    // Earlier versions took a negative price or value, which the API now refuses (UI-06).
    it('imports a bottle without its negative price or value, and keeps them in its notes', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        const [bottle] = data.wineBottles;
        data.wineBottles = [
            { ...bottle, purchasePrice: -5, currentValue: 40, notes: 'Gift' },
            { ...bottle, id: 'b2', barcode: null, purchasePrice: 0, currentValue: -0.5 },
            // The cut of a long note comes after the repair, as in the upgrades.
            {
                ...bottle,
                id: 'b3',
                barcode: null,
                purchasePrice: -1,
                notes: 'a'.repeat(4_990)
            }
        ];

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(200);
        const bottles = await db.select().from(wineBottles);
        expect(
            bottles.map(({ purchasePrice, currentValue, notes }) => ({
                purchasePrice,
                currentValue,
                notes
            }))
        ).toEqual([
            {
                purchasePrice: null,
                currentValue: 40,
                notes: 'Gift\nPurchase price -5 removed in the import: prices are 0 or more.'
            },
            {
                purchasePrice: 0,
                currentValue: null,
                notes: 'Current value -0.5 removed in the import: values are 0 or more.'
            },
            {
                purchasePrice: null,
                currentValue: null,
                notes: `${'a'.repeat(4_990)}\nPurchase`
            }
        ]);
    });

    // Before 0.10.0, a note or a description could hold 100,000 characters (DATA-10).
    it('cuts a note or a description longer than 5,000 characters, as the upgrade does', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        // Earlier forms stored CRLF line breaks, which the app counts as one character.
        data.wineDefinitions[0].description = `${'a'.repeat(4_998)}\r\nbc`;
        // An emoji is two UTF-16 units: the cut does not keep half of it.
        data.wineBottles[0].notes = `${'a'.repeat(4_999)}🍷`;

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(200);
        const [wine] = await db.select().from(wineDefinitions);
        const [bottle] = await db.select().from(wineBottles);
        expect(wine.description).toBe(`${'a'.repeat(4_998)}\nb`);
        expect(bottle.notes).toBe('a'.repeat(4_999));
    });

    it('keeps the colour value of a wine colour, and gives one to a colour of an export before 1.4.0', async () => {
        await db.update(wineColors).set({ hex: '#123456' });
        const zip = await exportZip();
        await db.update(wineColors).set({ hex: '#000000' });

        expect((await importZip(zip)).status).toBe(200);
        expect((await db.select().from(wineColors)).map(({ hex }) => hex)).toEqual(['#123456']);

        const data = JSON.parse(JSON.stringify(await snapshot()));
        delete data.wineColors[0].hex;
        data.wineColors.push({ id: 'orange', color: 'Orange', ...timestamps });

        expect((await importZip(craftedZip(data))).status).toBe(200);
        const colors = await db.select().from(wineColors);
        expect(Object.fromEntries(colors.map(({ color, hex }) => [color, hex]))).toEqual({
            Red: startingHex('Red'),
            Orange: NEUTRAL_HEX
        });
    });

    // Versions before 1.1.0 counted an emoji as one character in a name, a producer or a grape
    // variety: refused now, such a value would refuse the whole import (API-13).
    it('cuts a name, a producer or a grape variety that an earlier version took, never in an emoji', async () => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        const emoji = (count: number) => '🍷'.repeat(count);
        data.countries[0].name = `${emoji(250)}a`;
        data.wineTypes[0].type = `a${emoji(250)}`;
        // Measured once trimmed, as the API measures it.
        data.wineColors[0].color = ` ${emoji(250)} `;
        Object.assign(data.wineDefinitions[0], {
            name: emoji(250),
            producer: `${emoji(250)}b`,
            grapeVarieties: [`${emoji(50)}g`, 'Merlot']
        });

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(200);
        const [country] = await db.select().from(countries);
        const [type] = await db.select().from(wineTypes);
        const [color] = await db.select().from(wineColors);
        const [wine] = await db.select().from(wineDefinitions);
        expect(country.name).toBe(emoji(250));
        expect(type.type).toBe(`a${emoji(249)}`);
        expect(color.color).toBe(emoji(250));
        expect(wine).toMatchObject({
            name: emoji(250),
            producer: emoji(250),
            grapeVarieties: [emoji(50), 'Merlot']
        });
    });

    // A case is named after its container followed by its suffix, of 500 and 50 characters at
    // most. The imports checked it against 500: 1.0.0 refused the case of a container of 500
    // letters, and so would the UTF-16 units of API-13 that of a container of 250 emoji.
    it.each([
        ['500 letters', 'y'.repeat(500)],
        ['250 emoji', '🍷'.repeat(250)]
    ])('imports whole the case of a container of %s', async (_, container) => {
        const data = JSON.parse(JSON.stringify(await snapshot()));
        data.storageContainers[0].name = container;
        data.storageCases[0].name = `${container}1`;

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(200);
        expect((await db.select().from(storageCases)).map(({ name }) => name)).toEqual([
            `${container}1`
        ]);
    });

    // 1.0.0 took a container of 276 emoji, cut to 250 here; a cut of its cases would drop their
    // suffix, or make two cases alike. Restoring the backup zip brings them back.
    it('refuses the case of a container of more than 275 emoji, and changes nothing', async () => {
        const before = await snapshot();
        const data = JSON.parse(JSON.stringify(before));
        data.storageContainers[0].name = '🍷'.repeat(276);
        data.storageCases[0].name = `${'🍷'.repeat(276)}1`;

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(422);
        expect((await response.json()).error.details).toMatchObject({
            problem: 'invalid_row',
            table: 'storageCases',
            problems: [{ code: 'invalid', column: 'name' }]
        });
        expect(await snapshot()).toEqual(before);
    });

    // Two names alike in their first 500 UTF-16 units become one once cut: the database refuses
    // the second, as two rows of the same name (API-13).
    it.each([
        ['duplicate_container', 'storageContainers'],
        ['other', 'countries']
    ])(
        'answers 422 %s, and changes nothing, for two %s that the cut makes alike',
        async (rule, table) => {
            const before = await snapshot();
            const data = JSON.parse(JSON.stringify(before));
            const [row] = data[table];
            const prefix = '🍷'.repeat(250);
            row.name = `${prefix}A`;
            data[table].push({ ...row, id: 'twin', name: `${prefix}B` });

            const response = await importZip(craftedZip(data));

            expect(response.status).toBe(422);
            expect((await response.json()).error).toMatchObject({
                code: 'export_refused',
                details: { rule }
            });
            expect(await snapshot()).toEqual(before);
        }
    );

    it('refuses a row that breaks a rule of the API, before changing anything', async () => {
        const before = await snapshot();
        const data = JSON.parse(JSON.stringify(before));
        data.wineDefinitions[0].grapeVarieties = Array.from({ length: 51 }, (_, i) => `G${i}`);

        const response = await importZip(craftedZip(data));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_export',
            details: {
                problem: 'invalid_row',
                table: 'wineDefinitions',
                row: 1,
                problems: [{ code: 'invalid', column: 'grapeVarieties' }]
            }
        });
        expect(await snapshot()).toEqual(before);
        expect(dataFiles()).toEqual([]);
    });

    it('refuses an automatic export of 0.5.0 before changing anything', async () => {
        const before = await snapshot();
        // The tables that the automatic exports of 0.5.0 and earlier held.
        const automaticExport = {
            wineDefinitions: before.wineDefinitions,
            wineBottles: before.wineBottles,
            wineTypes: before.wineTypes,
            wineColors: before.wineColors,
            origins: before.origins,
            storageCases: before.storageCases,
            wineFormats: before.wineFormats,
            wineImages: before.wineImages
        };

        const response = await importZip(craftedZip(automaticExport));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'invalid_export',
            details: {
                problem: 'incomplete',
                tables: 'countries, regions, appellations, wineClassifications, storageContainers'
            }
        });
        expect(await snapshot()).toEqual(before);
        expect(existsSync(path.join(IMAGES_DIR, 'new.jpg'))).toBe(false);
        // Neither a pre-import backup nor the extracted files.
        expect(dataFiles()).toEqual([]);
    });

    it('changes nothing, images included, when a row cannot be inserted', async () => {
        const before = await snapshot();
        const exported = Object.fromEntries(
            Object.entries(before).map(([name, rows]) => [name, JSON.parse(JSON.stringify(rows))])
        );
        failWrites('INSERT', 'wine_bottles', '1');

        const response = await importZip(craftedZip(exported));

        // The trigger's refusal counts as a constraint: what matters is the rollback.
        expect(response.status).toBe(422);
        expect((await response.json()).error.details.rule).toBe('other');
        expect(await snapshot()).toEqual(before);
        expect(existsSync(path.join(IMAGES_DIR, 'new.jpg'))).toBe(false);
        // Nothing changed: neither the pre-import backup nor the extracted files stay.
        expect(dataFiles()).toEqual([]);
    });

    it('keeps the imported data when its images cannot be copied, and says so', async () => {
        const before = await snapshot();
        const exported = JSON.parse(JSON.stringify(before));
        exported.countries.push({ ...exported.countries[0], id: 'it', name: 'Italy' });
        // A folder where the image goes makes the copy fail.
        mkdirSync(path.join(IMAGES_DIR, 'new.jpg'));

        const response = await importZip(craftedZip(exported));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            restored: { database: true, images: false },
            imagesCopyFailed: true
        });
        expect((await db.select().from(countries)).map((country) => country.name)).toContain(
            'Italy'
        );
    });

    it('answers 422 and changes nothing when a row refers to one the export lacks', async () => {
        const before = await snapshot();
        const exported = JSON.parse(JSON.stringify(before));
        exported.wineDefinitions[0].appellationId = 'no-such-appellation';

        const response = await importZip(craftedZip(exported));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'export_refused',
            details: { rule: 'missing_reference' }
        });
        expect(await snapshot()).toEqual(before);
        expect(dataFiles()).toEqual([]);
    });

    // A hand-edited export: the schema gives a new row an id and timestamps, never an imported one.
    it.each(['id', 'createdAt', 'updatedAt'])(
        'answers 422 and changes nothing when a row lacks its %s',
        async (field) => {
            const before = await snapshot();
            const exported = JSON.parse(JSON.stringify(before));
            // A row that no other row refers to: a new id would break no link.
            const italy = { ...exported.countries[0], id: 'it', name: 'Italy' };
            delete italy[field];
            exported.countries.push(italy);

            const response = await importZip(craftedZip(exported));

            expect(response.status).toBe(422);
            expect((await response.json()).error.code).toBe('export_refused');
            expect(await snapshot()).toEqual(before);
        }
    );

    // 0.5.0 let two bottles share a barcode, and 0.10.0 two containers or two cases of a
    // container share a name; the database now refuses them.
    it.each([
        ['duplicate_barcode', 'wineBottles'],
        ['duplicate_container', 'storageContainers'],
        ['duplicate_case', 'storageCases']
    ])(
        'names the rule %s that refuses a row of an older export, and changes nothing',
        async (rule, table) => {
            const before = await snapshot();
            const exported = JSON.parse(JSON.stringify(before));
            exported[table].push({ ...exported[table][0], id: 'copy' });

            const response = await importZip(craftedZip(exported));

            expect(response.status).toBe(422);
            expect((await response.json()).error).toMatchObject({
                code: 'export_refused',
                details: { rule }
            });
            expect(await snapshot()).toEqual(before);
            expect(dataFiles()).toEqual([]);
        }
    );
});
