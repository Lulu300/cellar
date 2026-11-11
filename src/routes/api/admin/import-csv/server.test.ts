import { readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    producers,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineClassifications,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineImages,
    wineTypes
} from '#lib/server/db/schema.js';
import { getBarcodeSettings, getNextBarcodeNumber } from '#lib/server/features/barcode/service.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { MAX_CSV_UPLOAD_BYTES } from '#lib/server/features/csv-import/service.js';
import { DATA_DIR } from '#lib/server/paths.js';
import { formatBarcode } from '#lib/shared/barcode.js';
import { exportCsvFiles } from '../../../../test/csv-export';
import { fakeEvent } from '../../../../test/event';
import { failWrites } from '../../../../test/failing-write';
import { POST } from './+server';

type Event = Parameters<typeof POST>[0];

function importCsv(fileName: string, content: string) {
    return importCsvFiles([new File([content], fileName, { type: 'text/csv' })]);
}

function importCsvFiles(files: File[], fields: Record<string, string> = {}) {
    const body = new FormData();
    for (const file of files) body.append('files', file);
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    return POST(
        fakeEvent<Event>({
            method: 'POST',
            path: '/api/admin/import-csv',
            routeId: '/api/admin/import-csv',
            body
        })
    );
}

/** The wines of the producer named `name`. */
async function winesOf(name: string) {
    const [producer] = await db.select().from(producers).where(eq(producers.name, name));
    return db.select().from(wineDefinitions).where(eq(wineDefinitions.producerId, producer.id));
}

async function countryNames() {
    return (await db.select().from(countries)).map((country) => country.name);
}

describe('POST /api/admin/import-csv', () => {
    it('imports each row of the file and removes its temporary copy', async () => {
        const response = await importCsv('countries.csv', 'name\nFrance\n"Bosnia, Herzegovina"\n');

        expect(response.status).toBe(200);
        expect((await response.json()).summary).toMatchObject({
            totalImported: 2,
            totalFailed: 0
        });
        expect(await countryNames()).toEqual(
            expect.arrayContaining(['France', 'Bosnia, Herzegovina'])
        );
        // The route copies each file to DATA_DIR before parsing it; only the database stays there.
        expect(readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'))).toEqual([]);
    });

    it('modifies no prototype when a header is __proto__', async () => {
        const prototypeKeys = Object.getOwnPropertyNames(Object.prototype);

        // The route does not group duplicated columns, so GHSA-8cw4-87c7-c6xx cannot be reached
        // here. Since csv-parse 7.0.2 a __proto__ header becomes an own key of each record: the
        // import must still succeed and change no prototype.
        const response = await importCsv('countries.csv', '__proto__,name\npolluted,Italy\n');

        expect(response.status).toBe(200);
        expect((await response.json()).summary).toMatchObject({
            totalImported: 1,
            totalFailed: 0
        });
        expect(await countryNames()).toContain('Italy');
        expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(prototypeKeys);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('reports the incomplete rows of any table and imports the others', async () => {
        const containerId = 'cellar';
        const now = new Date();
        await db
            .insert(storageContainers)
            .values({ id: containerId, name: 'Cellar', createdAt: now, updatedAt: now });

        const response = await importCsvFiles([
            new File(['name,code\nNorway,NO\n,XX\nSweden,SE\n,\n'], 'countries.csv', {
                type: 'text/csv'
            }),
            new File(
                [
                    'name,containerName,capacity\nCellar1,Cellar,6\nCellar2,Cellar,\nCellar3,Cellar,lots\n'
                ],
                'storageCases.csv',
                { type: 'text/csv' }
            )
        ]);

        expect(response.status).toBe(200);
        const { results, summary } = await response.json();
        expect(summary).toMatchObject({ totalImported: 3, totalFailed: 4 });
        expect(results.flatMap((result: { errors: unknown[] }) => result.errors)).toEqual([
            { row: 2, problems: [{ code: 'missing', column: 'name' }] },
            { row: 4, problems: [{ code: 'missing', column: 'name' }] },
            { row: 2, problems: [{ code: 'missing', column: 'capacity' }] },
            { row: 3, problems: [{ code: 'invalid', column: 'capacity' }] }
        ]);
        expect(await countryNames()).toEqual(expect.arrayContaining(['Norway', 'Sweden']));
        expect((await db.select().from(storageCases)).map((c) => c.name)).toEqual(['Cellar1']);
    });

    it('reports, as codes, the files it cannot read and the rows already in the cellar', async () => {
        await importCsv('countries.csv', 'name\nNorway\n');

        const response = await importCsvFiles([
            new File(['name\nNorway\nAtlantis\n'], 'countries.csv'),
            new File(['name\nNorway\n'], 'notes.csv'),
            new File(['name,regionName\n"Cru,Hillside\n'], 'appellations.csv')
        ]);

        expect((await response.json()).results).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    table: null,
                    file: 'notes.csv',
                    errors: [{ row: 0, problems: [{ code: 'no_table' }] }]
                }),
                expect.objectContaining({
                    table: 'appellations',
                    file: 'appellations.csv',
                    errors: [{ row: 0, problems: [{ code: 'not_csv', line: 2 }] }]
                }),
                expect.objectContaining({
                    successfulImports: 1,
                    skipped: [{ row: 1, reason: { code: 'same_name', name: 'Norway' } }]
                })
            ])
        );
    });

    it('reports the appellations whose region is unknown or blank and imports the others', async () => {
        const now = new Date();
        await db
            .insert(countries)
            .values({ id: 'testland', name: 'Testland', createdAt: now, updatedAt: now });
        await db.insert(regions).values({
            id: 'hillside',
            name: 'Hillside',
            countryId: 'testland',
            createdAt: now,
            updatedAt: now
        });

        const response = await importCsv(
            'appellations.csv',
            'name,regionName\nCru Alpha,Hillside\nCru Beta,Nowhere\nCru Gamma,\n'
        );

        expect(response.status).toBe(200);
        const { results, summary } = await response.json();
        expect(summary).toMatchObject({ totalImported: 1, totalFailed: 2 });
        expect(results[0].errors).toEqual([
            {
                row: 2,
                problems: [{ code: 'unknown_reference', column: 'regionName', name: 'Nowhere' }]
            },
            { row: 3, problems: [{ code: 'missing', column: 'regionName' }] }
        ]);
        const names = (await db.select().from(appellations)).map((a) => a.name);
        expect(names).toContain('Cru Alpha');
        expect(names).not.toContain('Cru Beta');
    });

    it('reports a row with more or fewer values than the header and imports the others', async () => {
        const response = await importCsv(
            'countries.csv',
            'name\nUruguay\n"Chile",extra\n\nParaguay\n'
        );

        expect(response.status).toBe(200);
        const [result] = (await response.json()).results;
        expect(result).toMatchObject({ totalRows: 3, successfulImports: 2, failedImports: 1 });
        expect(result.errors).toEqual([
            { row: 2, problems: [{ code: 'uneven_row', values: 2, columns: 1 }] }
        ]);
        const names = await countryNames();
        expect(names).toEqual(expect.arrayContaining(['Uruguay', 'Paraguay']));
        expect(names).not.toContain('Chile');
    });

    it('counts every row skipped in a large file and lists the first 1,000 only', async () => {
        await importCsv('countries.csv', 'name\nLargeland\n');

        const response = await importCsv('countries.csv', `name${'\nLargeland'.repeat(20_000)}\n`);

        expect(response.status).toBe(200);
        const { results, summary } = await response.json();
        expect(summary).toMatchObject({ totalSkipped: 20_000 });
        expect(results[0]).toMatchObject({ totalRows: 20_000, skippedImports: 20_000 });
        expect(results[0].skipped).toHaveLength(1000);
        expect(results[0].skipped.at(-1).row).toBe(1000);
    });

    it('matches a region by its country and an appellation by its region, when the file gives them', async () => {
        const now = new Date();
        await db.insert(countries).values([
            { id: 'northia', name: 'Northia', createdAt: now, updatedAt: now },
            { id: 'southia', name: 'Southia', createdAt: now, updatedAt: now }
        ]);
        await db.insert(regions).values({
            id: 'valley-north',
            name: 'Valley',
            countryId: 'northia',
            createdAt: now,
            updatedAt: now
        });

        const regionsResponse = await importCsv(
            'regions.csv',
            'name,countryName\nVALLEY,Northia\nValley,Southia\n'
        );
        const appellationsResponse = await importCsv(
            'appellations.csv',
            'name,regionName,countryName\nHill,Valley,Southia\nHill,Valley,Northia\n'
        );

        expect((await regionsResponse.json()).results[0]).toMatchObject({
            successfulImports: 1,
            skipped: [{ row: 1, reason: { code: 'same_name', name: 'Valley' } }]
        });
        expect((await appellationsResponse.json()).summary).toMatchObject({ totalImported: 2 });
        const valleys = await db.select().from(regions).where(eq(regions.name, 'Valley'));
        expect(valleys.map((region) => region.countryId).toSorted()).toEqual([
            'northia',
            'southia'
        ]);
        const hills = await db.select().from(appellations).where(eq(appellations.name, 'Hill'));
        expect(hills.map((hill) => hill.regionId).toSorted()).toEqual(
            valleys.map((region) => region.id).toSorted()
        );
    });

    it('imports nothing from any of the files when a row cannot be inserted', async () => {
        const countriesBefore = await db.select().from(countries);
        const containersBefore = await db.select().from(storageContainers);
        failWrites('INSERT', 'countries', "NEW.name = 'Spain'");

        const response = await importCsvFiles([
            new File(['name\nCellar door\n'], 'storageContainers.csv', { type: 'text/csv' }),
            new File(['name\nGermany\nSpain\nAustria\n'], 'countries.csv', { type: 'text/csv' })
        ]);

        // The trigger's refusal counts as a constraint: what matters is the rollback.
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'import_row_refused',
            details: { file: 'countries.csv', row: 2 }
        });
        expect(await db.select().from(countries)).toEqual(countriesBefore);
        expect(await db.select().from(storageContainers)).toEqual(containersBefore);
        expect(readdirSync(DATA_DIR).filter((name) => !name.startsWith('cellar.db'))).toEqual([]);
    });

    it('answers in the API error format to a request without CSV files', async () => {
        for (const response of [
            await importCsvFiles([]),
            await importCsv('countries.txt', 'name\nFrance\n')
        ]) {
            expect(response.status).toBe(422);
            expect((await response.json()).error.code).toBe('invalid_body');
        }
    });

    it('answers 413 to an upload announced over the limit, before reading it', async () => {
        const event = fakeEvent<Event>({
            method: 'POST',
            path: '/api/admin/import-csv',
            routeId: '/api/admin/import-csv'
        });
        const request = new Request(event.request.url, {
            method: 'POST',
            body: 'x',
            headers: { 'content-length': String(MAX_CSV_UPLOAD_BYTES * 2) }
        });

        const response = await POST({ ...event, request });

        expect(response.status).toBe(413);
        expect((await response.json()).error.code).toBe('body_too_large');
    });

    it('reads the table from the end of an export name that holds another table name', async () => {
        const fileName = 'cellar-export-regions-wineFormats-2026-10-13T10-00.csv';

        const response = await importCsv(fileName, 'name\nRehoboam\n');

        expect((await response.json()).results[0]).toMatchObject({
            table: 'wineFormats',
            file: fileName,
            successfulImports: 1
        });
        expect((await db.select().from(wineFormats)).map((format) => format.name)).toContain(
            'Rehoboam'
        );
    });

    it('takes only the columns of its table, and never an id', async () => {
        const response = await importCsv(
            'storageContainers.csv',
            'name,parentContainerId,createdAt,id\nShelf,no-such-container,yesterday,mine\n'
        );

        expect((await response.json()).summary).toMatchObject({ totalImported: 1, totalFailed: 0 });
        const [shelf] = await db
            .select()
            .from(storageContainers)
            .where(eq(storageContainers.name, 'Shelf'));
        expect(shelf).toMatchObject({ parentContainerId: null, createdAt: expect.any(Date) });
        expect(shelf.id).not.toBe('mine');
        expect(shelf.createdAt.getTime()).not.toBeNaN();
    });

    describe('wine definitions', () => {
        beforeAll(async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db.insert(countries).values({ id: 'pt', name: 'Portugal', ...timestamps });
            await db
                .insert(regions)
                .values({ id: 'douro', name: 'Douro', countryId: 'pt', ...timestamps });
            await db
                .insert(appellations)
                .values({ id: 'porto', name: 'Porto', regionId: 'douro', ...timestamps });
            await db
                .insert(wineTypes)
                .values({ id: 'fortified', type: 'Fortified', ...timestamps });
            await db.insert(wineColors).values([
                { id: 'red', color: 'Red', ...timestamps },
                { id: 'white', color: 'White', ...timestamps }
            ]);
            await db
                .insert(wineClassifications)
                .values({ id: 'vintage', name: 'Vintage', ...timestamps });
            // Same name, told apart by colour and classification
            const wine = { name: 'Quinta do Noval', appellationId: 'porto', typeId: 'fortified' };
            await db.insert(wineDefinitions).values([
                {
                    id: 'noval-red',
                    ...wine,
                    colorId: 'red',
                    classificationId: 'vintage',
                    ...timestamps
                },
                { id: 'noval-white', ...wine, colorId: 'white', ...timestamps }
            ]);
        });

        it('imports its own export without duplicating a wine', async () => {
            const files = await exportCsvFiles([
                'countries',
                'regions',
                'appellations',
                'wineTypes',
                'wineColors',
                'wineClassifications',
                'wineDefinitions'
            ]);
            const winesBefore = await db.select().from(wineDefinitions);

            const response = await importCsvFiles(files);

            expect(response.status).toBe(200);
            expect((await response.json()).summary).toMatchObject({
                totalImported: 0,
                totalFailed: 0
            });
            expect(await db.select().from(wineDefinitions)).toHaveLength(winesBefore.length);
        });

        it('recognises the wines of an export that has no regionName column', async () => {
            const response = await importCsv(
                'wineDefinitions.csv',
                'name,appellationName,classificationName,typeName,colorName\n' +
                    'Quinta do Noval,Porto,Vintage,Fortified,Red\n'
            );

            expect((await response.json()).summary).toMatchObject({
                totalImported: 0,
                totalSkipped: 1
            });
        });

        it('imports nothing when the image row of a wine cannot be inserted', async () => {
            const winesBefore = await db.select().from(wineDefinitions);
            failWrites('INSERT', 'wine_images', '1');

            const response = await importCsv(
                'wineDefinitions.csv',
                'name,producer,appellationName,typeName,colorName,imageName\n' +
                    'Tawny,Taylor,Porto,Fortified,Red,\n' +
                    'Colheita,Kopke,Porto,Fortified,Red,colheita.jpg\n'
            );

            expect(response.status).toBe(409);
            expect((await response.json()).error.details).toEqual({
                file: 'wineDefinitions.csv',
                row: 2
            });
            expect(await db.select().from(wineDefinitions)).toEqual(winesBefore);
        });

        it('reports an invalid row of a wine already in the cellar as invalid', async () => {
            const response = await importCsv(
                'wineDefinitions.csv',
                'name,appellationName,classificationName,typeName,colorName,website\n' +
                    'Quinta do Noval,Porto,Vintage,Fortified,Red,not a website\n'
            );

            expect((await response.json()).results[0]).toMatchObject({
                skippedImports: 0,
                errors: [{ row: 1, problems: [{ code: 'invalid', column: 'website' }] }]
            });
        });

        it('reports an invalid image name on the imageName column, and adds no image', async () => {
            const imagesBefore = await db.select().from(wineImages);

            const response = await importCsv(
                'wineDefinitions.csv',
                'name,appellationName,typeName,colorName,imageName\n' +
                    'Ruby,Porto,Fortified,Red,../ruby.png\n' +
                    'Quinta do Noval,Porto,Fortified,White,noval.png\n'
            );

            expect((await response.json()).results[0]).toMatchObject({
                skippedImports: 1,
                errors: [{ row: 1, problems: [{ code: 'invalid', column: 'imageName' }] }]
            });
            expect(await db.select().from(wineImages)).toEqual(imagesBefore);
        });

        it('matches the appellation of a wine by its region, when the file gives it, and names both otherwise', async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db
                .insert(regions)
                .values({ id: 'minho', name: 'Minho', countryId: 'pt', ...timestamps });
            await db
                .insert(appellations)
                .values({ id: 'porto-minho', name: 'Porto', regionId: 'minho', ...timestamps });

            const header = 'name,regionName,appellationName,typeName,colorName\n';
            const unknown = `${header}Lagos,Algarve,Porto,Fortified,White\n`;

            const response = await importCsv(
                'wineDefinitions.csv',
                `${header}Alvarinho,Minho,Porto,Fortified,White\n`
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 1 });
            expect(
                (await (await importCsv('wineDefinitions.csv', unknown)).json()).results[0].errors
            ).toEqual([
                {
                    row: 1,
                    problems: [
                        {
                            code: 'unknown_reference',
                            column: 'appellationName',
                            name: 'Porto (Algarve)'
                        }
                    ]
                }
            ]);
            const [alvarinho] = await db
                .select()
                .from(wineDefinitions)
                .where(eq(wineDefinitions.name, 'Alvarinho'));
            expect(alvarinho.appellationId).toBe('porto-minho');
        });

        it('imports wines that differ only by producer', async () => {
            const response = await importCsv(
                'wineDefinitions.csv',
                'name,producer,appellationName,typeName,colorName\n' +
                    'Reserva,Niepoort,Porto,Fortified,Red\n' +
                    'Reserva,Ramos Pinto,Porto,Fortified,Red\n'
            );

            expect((await response.json()).summary).toMatchObject({
                totalImported: 2,
                totalSkipped: 0,
                totalFailed: 0
            });
        });

        it('imports a rating of 0 as no rating', async () => {
            const response = await importCsv(
                'wineDefinitions.csv',
                'name,producer,appellationName,typeName,colorName,rating\n' +
                    'Unrated,Graham,Porto,Fortified,Red,0\n'
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 1 });
            const [unrated] = await db
                .select()
                .from(wineDefinitions)
                .where(eq(wineDefinitions.name, 'Unrated'));
            expect(unrated.rating).toBeNull();
        });

        it('imports a wine listed twice in the same file once, and a row that differs by its rating apart', async () => {
            const row = 'Quinta do Vesuvio,Douro,Porto,Fortified,Red';
            const response = await importCsv(
                'wineDefinitions.csv',
                `name,regionName,appellationName,typeName,colorName,rating\n${row},4\n${row},4\n${row},5\n`
            );

            expect((await response.json()).summary).toMatchObject({
                totalImported: 2,
                totalSkipped: 1,
                totalFailed: 0
            });
            const vesuvio = await db
                .select()
                .from(wineDefinitions)
                .where(eq(wineDefinitions.name, 'Quinta do Vesuvio'));
            expect(vesuvio.map((wine) => wine.rating).toSorted()).toEqual([4, 5]);
        });
        it('reports a wine whose classification is unknown, then imports it once it exists', async () => {
            const wine =
                'name,producer,appellationName,typeName,colorName,classificationName\n' +
                'LBV,Warre,Porto,Fortified,Red,Late Bottled\n';

            const first = await (await importCsv('wineDefinitions.csv', wine)).json();
            const second = await importCsvFiles([
                new File(['name\nLate Bottled\n'], 'wineClassifications.csv'),
                new File([wine], 'wineDefinitions.csv')
            ]);
            const third = await (await importCsv('wineDefinitions.csv', wine)).json();

            expect(first.results[0].errors).toEqual([
                {
                    row: 1,
                    problems: [
                        {
                            code: 'unknown_reference',
                            column: 'classificationName',
                            name: 'Late Bottled'
                        }
                    ]
                }
            ]);
            expect((await second.json()).summary).toMatchObject({ totalImported: 2 });
            expect(third.summary).toMatchObject({ totalImported: 0, totalSkipped: 1 });
            const lbv = await db
                .select()
                .from(wineDefinitions)
                .where(eq(wineDefinitions.name, 'LBV'));
            expect(lbv).toHaveLength(1);
        });

        // FEAT-07: a wine file names the producer, as before producers were a list.
        it('creates the producers that a wine file names, and finds one by any spelling of its name', async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db.insert(producers).values({ id: 'taylor', name: "Taylor's", ...timestamps });
            await db.insert(wineFormats).values({ id: 'pipe', name: 'Pipe', ...timestamps });

            const response = await importCsvFiles([
                new File(
                    [
                        'name,producer,appellationName,typeName,colorName\n' +
                            'Vargellas,TAYLOR’S,Porto,Fortified,Red\n' +
                            'Crusted,Churchill  Graham,Porto,Fortified,Red\n' +
                            'Reserve,churchill graham,Porto,Fortified,Red\n'
                    ],
                    'wineDefinitions.csv'
                ),
                // Its producer spelt another way, as a bottle file written by hand may.
                new File(
                    ['wineName,producer,formatName\nCrusted,CHURCHILL GRAHAM,Pipe\n'],
                    'wineBottles.csv'
                )
            ]);

            expect((await response.json()).summary).toMatchObject({
                totalImported: 4,
                totalFailed: 0
            });
            const churchill = await db
                .select()
                .from(producers)
                .where(eq(producers.name, 'Churchill Graham'));
            expect(churchill).toHaveLength(1);
            expect((await winesOf("Taylor's")).map(({ name }) => name)).toEqual(['Vargellas']);
            const crusted = await winesOf('Churchill Graham');
            expect(crusted.map(({ name }) => name)).toEqual(['Crusted', 'Reserve']);
            const bottles = await db
                .select()
                .from(wineBottles)
                .where(eq(wineBottles.formatId, 'pipe'));
            expect(bottles.map(({ definitionId }) => definitionId)).toEqual([crusted[0].id]);
        });

        it('reads a rating with decimals, and keeps one outside 1 to 5 in the description', async () => {
            const response = await importCsv(
                'wineDefinitions.csv',
                'name,producer,appellationName,typeName,colorName,rating,description\n' +
                    'Half,Dow,Porto,Fortified,Red,4.5,\n' +
                    'Comma,Dow,Porto,Fortified,Red,"3,5",\n' +
                    'Seven,Dow,Porto,Fortified,Red,7,Old notes\n'
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 3 });
            const wines = await winesOf('Dow');
            expect(
                wines.map(({ name, rating, description }) => [name, rating, description])
            ).toEqual([
                ['Half', 4.5, null],
                ['Comma', 3.5, null],
                [
                    'Seven',
                    null,
                    'Old notes\nRating 7 removed in the import: ratings go from 1 to 5.'
                ]
            ]);
        });

        it('reads grape varieties as a list of names, and keeps a wrong target in the description', async () => {
            const tooMany = Array.from({ length: 51 }, (_, i) => `Grape ${i}`).join('; ');
            const response = await importCsv(
                'wineDefinitions.csv',
                'name,producer,appellationName,typeName,colorName,grapeVarieties,targetQuantity\n' +
                    'Number,Fonseca,Porto,Fortified,Red,5,\n' +
                    'List,Fonseca,Porto,Fortified,Red,Touriga Nacional; Tinta Roriz,\n' +
                    'Json,Fonseca,Porto,Fortified,Red,"[""Touriga Franca""]",\n' +
                    `Many,Fonseca,Porto,Fortified,Red,${tooMany},\n` +
                    'Target,Fonseca,Porto,Fortified,Red,,20000\n'
            );

            const { results } = await response.json();
            expect(results[0].errors).toEqual([
                { row: 4, problems: [{ code: 'invalid', column: 'grapeVarieties' }] }
            ]);
            const wines = await winesOf('Fonseca');
            expect(wines.map(({ grapeVarieties }) => grapeVarieties)).toEqual([
                ['5'],
                ['Touriga Nacional', 'Tinta Roriz'],
                ['Touriga Franca'],
                []
            ]);
            expect(wines[3]).toMatchObject({
                targetQuantity: null,
                description:
                    'Target quantity 20000 removed in the import: it is a whole number from 0 to 10000.'
            });
        });
    });

    describe('wine bottles', () => {
        beforeAll(async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db.insert(countries).values({ id: 'cl', name: 'Chile', ...timestamps });
            await db
                .insert(regions)
                .values({ id: 'maipo', name: 'Maipo', countryId: 'cl', ...timestamps });
            await db
                .insert(appellations)
                .values({ id: 'alto-maipo', name: 'Alto Maipo', regionId: 'maipo', ...timestamps });
            await db.insert(wineTypes).values({ id: 'csv-still', type: 'Tranquil', ...timestamps });
            await db.insert(wineColors).values({ id: 'csv-red', color: 'Ruby', ...timestamps });
            await db.insert(wineDefinitions).values({
                id: 'csv-wine',
                name: 'Viña Imaginaria',
                appellationId: 'alto-maipo',
                typeId: 'csv-still',
                colorId: 'csv-red',
                ...timestamps
            });
            await db
                .insert(wineFormats)
                .values({ id: 'csv-bottle', name: 'Bottle', ...timestamps });
        });

        it('does not give the numbers of imported bottles again once they are deleted', async () => {
            setAppSetting('barcode_prefix', 'CSV');
            setAppSetting('barcode_auto_generation', 'true');

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName\nViña Imaginaria,Bottle\nViña Imaginaria,Bottle\n'
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 2 });
            const imported = await db
                .select()
                .from(wineBottles)
                .where(eq(wineBottles.definitionId, 'csv-wine'));
            expect(imported.map((bottle) => bottle.barcode).toSorted()).toEqual([
                'CSV0000001',
                'CSV0000002'
            ]);

            await db.delete(wineBottles).where(eq(wineBottles.definitionId, 'csv-wine'));

            expect(getNextBarcodeNumber(getBarcodeSettings())).toBe(3);
        });

        it('gives no number to bottles that keep the barcode of the file', async () => {
            setAppSetting('barcode_prefix', 'OWN');
            setAppSetting('barcode_auto_generation', 'true');
            setAppSetting('barcode_start_number', '500');

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName,barcode\nViña Imaginaria,Bottle,MY-OWN-CODE\n'
            );
            expect((await response.json()).summary).toMatchObject({ totalImported: 1 });
            setAppSetting('barcode_start_number', '1');

            expect(getNextBarcodeNumber(getBarcodeSettings())).toBe(1);
        });

        it('gives each bottle the wine of its producer, and reports one the file cannot tell apart', async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db.insert(wineColors).values({ id: 'csv-white', color: 'Blanco', ...timestamps });
            await db.insert(producers).values([
                { id: 'casa-uno', name: 'Casa Uno', ...timestamps },
                { id: 'casa-dos', name: 'Casa Dos', ...timestamps }
            ]);
            const twin = { name: 'Gemelo', appellationId: 'alto-maipo', typeId: 'csv-still' };
            await db.insert(wineDefinitions).values([
                {
                    id: 'uno-ruby',
                    ...twin,
                    producerId: 'casa-uno',
                    colorId: 'csv-red',
                    ...timestamps
                },
                {
                    id: 'dos-ruby',
                    ...twin,
                    producerId: 'casa-dos',
                    colorId: 'csv-red',
                    ...timestamps
                },
                {
                    id: 'uno-white',
                    ...twin,
                    producerId: 'casa-uno',
                    colorId: 'csv-white',
                    ...timestamps
                }
            ]);

            // As the exports of 0.6.0 and earlier name the wine: by its name and producer only.
            const response = await importCsv(
                'wineBottles.csv',
                'wineName,producer,formatName\nGemelo,Casa Dos,Bottle\nGemelo,Casa Uno,Bottle\n'
            );

            expect((await response.json()).results[0].errors).toEqual([
                { row: 2, problems: [{ code: 'several_wines', name: 'Gemelo' }] }
            ]);
            const twins = (await db.select().from(wineBottles)).filter((bottle) =>
                ['uno-ruby', 'dos-ruby', 'uno-white'].includes(bottle.definitionId)
            );
            expect(twins).toEqual([expect.objectContaining({ definitionId: 'dos-ruby' })]);
        });

        it('reads a status in another case, and keeps an unknown one in the notes', async () => {
            setAppSetting('barcode_auto_generation', 'false');

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName,availability,vintage,notes\n' +
                    'Viña Imaginaria,Bottle,CONSUMED,,First\n' +
                    'Viña Imaginaria,Bottle,lost,2019,Second\n' +
                    'Viña Imaginaria,Bottle,available,1e3,Third\n'
            );

            expect((await response.json()).results[0]).toMatchObject({
                successfulImports: 2,
                errors: [{ row: 3, problems: [{ code: 'invalid', column: 'vintage' }] }]
            });
            const bottles = await db
                .select()
                .from(wineBottles)
                .where(eq(wineBottles.definitionId, 'csv-wine'));
            expect(
                bottles
                    .filter((bottle) => bottle.notes)
                    .map(({ availability, vintage, notes }) => ({ availability, vintage, notes }))
            ).toEqual([
                { availability: 'consumed', vintage: null, notes: 'First' },
                {
                    availability: 'out_of_cellar',
                    vintage: 2019,
                    notes: 'Second\nStatus "lost" replaced by "out_of_cellar" in the import.'
                }
            ]);
        });

        // Earlier versions took a negative price or value, which the API now refuses (UI-06).
        it('imports a bottle without its negative price or value, and keeps them in its notes', async () => {
            setAppSetting('barcode_auto_generation', 'false');

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName,purchasePrice,currentValue,notes\n' +
                    'Viña Imaginaria,Bottle,-5,"-12,5",Negative\n' +
                    'Viña Imaginaria,Bottle,0,-1,\n' +
                    'Viña Imaginaria,Bottle,0,30,Kept\n'
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 3 });
            const bottles = await db
                .select()
                .from(wineBottles)
                .where(eq(wineBottles.definitionId, 'csv-wine'));
            expect(
                bottles.slice(-3).map(({ purchasePrice, currentValue, notes }) => ({
                    purchasePrice,
                    currentValue,
                    notes
                }))
            ).toEqual([
                {
                    purchasePrice: null,
                    currentValue: null,
                    notes:
                        'Negative\n' +
                        'Purchase price -5 removed in the import: prices are 0 or more.\n' +
                        'Current value -12.5 removed in the import: values are 0 or more.'
                },
                {
                    purchasePrice: 0,
                    currentValue: null,
                    notes: 'Current value -1 removed in the import: values are 0 or more.'
                },
                { purchasePrice: 0, currentValue: 30, notes: 'Kept' }
            ]);
        });

        // Before 0.10.0, a note or a description could hold 100,000 characters (DATA-10).
        it('cuts a note or a description longer than 5,000 characters, as the upgrade does', async () => {
            setAppSetting('barcode_auto_generation', 'false');
            const long = `${'a'.repeat(4_999)}bc`;

            const wines = await importCsv(
                'wineDefinitions.csv',
                'name,producer,appellationName,typeName,colorName,description\n' +
                    `Long,Taylor,Porto,Fortified,Red,${long}\n`
            );
            const bottles = await importCsv(
                'wineBottles.csv',
                `wineName,formatName,notes\nViña Imaginaria,Bottle,${long}\n`
            );

            expect((await wines.json()).summary).toMatchObject({ totalImported: 1 });
            expect((await bottles.json()).summary).toMatchObject({ totalImported: 1 });
            const [wine] = await db
                .select()
                .from(wineDefinitions)
                .where(eq(wineDefinitions.name, 'Long'));
            const [bottle] = await db
                .select()
                .from(wineBottles)
                .where(eq(wineBottles.notes, `${'a'.repeat(4_999)}b`));
            expect(wine.description).toBe(`${'a'.repeat(4_999)}b`);
            expect(bottle).toBeDefined();
        });

        // Up to 0.6.0, the CSV import stored a blank vintage as 0, which its exports then held.
        it('imports a vintage of 0 as no vintage', async () => {
            setAppSetting('barcode_auto_generation', 'false');

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName,vintage,notes\nViña Imaginaria,Bottle,0,Non-vintage\n'
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 1 });
            const [bottle] = await db
                .select()
                .from(wineBottles)
                .where(eq(wineBottles.notes, 'Non-vintage'));
            expect(bottle.vintage).toBeNull();
        });

        it('reports the bottles in the cellar that a case has no room for', async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db
                .insert(storageContainers)
                .values({ id: 'csv-rack', name: 'Box', ...timestamps });
            await db.insert(storageCases).values({
                id: 'csv-tiny',
                name: 'Tiny',
                capacity: 1,
                containerId: 'csv-rack',
                ...timestamps
            });

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName,storageCaseName,availability\n' +
                    'Viña Imaginaria,Bottle,Tiny,available\n' +
                    'Viña Imaginaria,Bottle,Tiny,available\n' +
                    'Viña Imaginaria,Bottle,Tiny,out_of_cellar\n'
            );

            expect((await response.json()).results[0]).toMatchObject({
                successfulImports: 2,
                errors: [{ row: 2, problems: [{ code: 'case_full', name: 'Tiny', capacity: 1 }] }]
            });
        });

        // FEAT-12: a drunk bottle keeps the case it was in, without taking a place there.
        it('keeps the case of a consumed bottle when the cellar has it, and imports it in none otherwise', async () => {
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            await db
                .insert(storageContainers)
                .values({ id: 'csv-drawer', name: 'Drawer', ...timestamps });
            await db.insert(storageCases).values({
                id: 'csv-full',
                name: 'Full',
                capacity: 1,
                containerId: 'csv-drawer',
                ...timestamps
            });

            const response = await importCsv(
                'wineBottles.csv',
                'wineName,formatName,containerName,storageCaseName,availability,notes\n' +
                    'Viña Imaginaria,Bottle,,Full,available,In the cellar\n' +
                    'Viña Imaginaria,Bottle,,Full,consumed,Drunk from Full\n' +
                    'Viña Imaginaria,Bottle,,Gone,consumed,Drunk from a case since removed\n' +
                    // A case of this name is left, in another container: not the one it was in.
                    'Viña Imaginaria,Bottle,Removed,Full,consumed,Drunk from a container since removed\n' +
                    'Viña Imaginaria,Bottle,,Gone,available,In a case that does not exist\n'
            );

            expect((await response.json()).results[0]).toMatchObject({
                successfulImports: 4,
                errors: [
                    {
                        row: 5,
                        problems: [{ code: 'unknown_reference', column: 'storageCaseName' }]
                    }
                ]
            });
            const caseOf = async (notes: string) =>
                (await db.select().from(wineBottles).where(eq(wineBottles.notes, notes)))[0]
                    .storageCaseId;
            expect(await caseOf('Drunk from Full')).toBe('csv-full');
            expect(await caseOf('Drunk from a case since removed')).toBeNull();
            expect(await caseOf('Drunk from a container since removed')).toBeNull();
        });

        it('imports new bottles without a barcode alike to bottles of the cellar with one', async () => {
            setAppSetting('barcode_auto_generation', 'false');
            const timestamps = { createdAt: new Date(), updatedAt: new Date() };
            const bottle = { definitionId: 'csv-wine', formatId: 'csv-bottle', vintage: 2011 };
            await db.insert(wineBottles).values([
                { id: 'labelled-1', ...bottle, barcode: 'LBL-1', ...timestamps },
                { id: 'labelled-2', ...bottle, barcode: 'LBL-2', ...timestamps }
            ]);
            const row = 'Viña Imaginaria,Bottle,2011';

            const response = await importCsv(
                'wineBottles.csv',
                `wineName,formatName,vintage\n${row}\n${row}\n${row}\n`
            );

            expect((await response.json()).summary).toMatchObject({
                totalImported: 3,
                totalSkipped: 0
            });
        });

        it('gives automatic barcodes to available bottles only, so the others are recognised when the file is imported again', async () => {
            setAppSetting('barcode_prefix', 'AVL');
            setAppSetting('barcode_auto_generation', 'true');
            const file =
                'wineName,formatName,vintage,availability,barcode\n' +
                'Viña Imaginaria,Bottle,1977,available,OWN-AV-1\n' +
                'Viña Imaginaria,Bottle,1977,out_of_cellar,\n' +
                'Viña Imaginaria,Bottle,1977,consumed,\n';

            const first = await (await importCsv('wineBottles.csv', file)).json();
            const second = await (await importCsv('wineBottles.csv', file)).json();

            expect(first.summary).toMatchObject({ totalImported: 3 });
            // An available bottle without a barcode would be added again: it takes a number, and a
            // bottle with a barcode is only recognised by it.
            const bottles = (
                await db.select().from(wineBottles).orderBy(wineBottles.availability)
            ).filter((bottle) => bottle.vintage === 1977);
            expect(bottles.map(({ availability, barcode }) => [availability, barcode])).toEqual([
                ['available', 'OWN-AV-1'],
                ['consumed', null],
                ['out_of_cellar', null]
            ]);
            expect(second.summary).toMatchObject({ totalImported: 0, totalSkipped: 3 });
        });

        it('with new barcodes for all, numbers the bottles in the cellar and clears the others', async () => {
            setAppSetting('barcode_prefix', 'NEW');
            setAppSetting('barcode_auto_generation', 'true');
            const next = getNextBarcodeNumber(getBarcodeSettings());

            const response = await importCsvFiles(
                [
                    new File(
                        [
                            'wineName,formatName,vintage,availability,barcode\n' +
                                'Viña Imaginaria,Bottle,1966,available,FILE-1\n' +
                                'Viña Imaginaria,Bottle,1966,out_of_cellar,FILE-2\n' +
                                'Viña Imaginaria,Bottle,1966,consumed,FILE-3\n'
                        ],
                        'wineBottles.csv'
                    )
                ],
                { overrideAllBarcodes: 'true' }
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 3 });
            const bottles = (
                await db.select().from(wineBottles).orderBy(wineBottles.availability)
            ).filter((bottle) => bottle.vintage === 1966);
            expect(bottles.map(({ availability, barcode }) => [availability, barcode])).toEqual([
                ['available', formatBarcode('NEW', next)],
                ['consumed', null],
                ['out_of_cellar', null]
            ]);
        });

        it('gives no generated barcode that a later row of the file holds', async () => {
            setAppSetting('barcode_prefix', 'GEN');
            setAppSetting('barcode_auto_generation', 'true');
            const next = getNextBarcodeNumber(getBarcodeSettings());
            const taken = formatBarcode('GEN', next);

            const response = await importCsv(
                'wineBottles.csv',
                `wineName,formatName,vintage,barcode\nViña Imaginaria,Bottle,1999,\nViña Imaginaria,Bottle,1999,${taken}\n`
            );

            expect((await response.json()).summary).toMatchObject({ totalImported: 2 });
            const barcodes = (await db.select().from(wineBottles))
                .filter((bottle) => bottle.vintage === 1999)
                .map((bottle) => bottle.barcode);
            expect(barcodes).toEqual([formatBarcode('GEN', next + 1), taken]);
        });

        it('answers the report of a dry run without writing anything', async () => {
            setAppSetting('barcode_prefix', 'DRY');
            setAppSetting('barcode_auto_generation', 'true');
            const files = () => [
                new File(['name\nMagnum\n'], 'wineFormats.csv'),
                new File(
                    ['wineName,formatName\nViña Imaginaria,Magnum\nViña Imaginaria,Jeroboam\n'],
                    'wineBottles.csv'
                )
            ];
            const bottlesBefore = await db.select().from(wineBottles);
            const nextNumber = getNextBarcodeNumber(getBarcodeSettings());

            const dryRun = await (await importCsvFiles(files(), { dryRun: 'true' })).json();

            expect(dryRun).toMatchObject({
                dryRun: true,
                summary: { totalImported: 2, totalFailed: 1 }
            });
            expect(await db.select().from(wineBottles)).toEqual(bottlesBefore);
            const formats = (await db.select().from(wineFormats)).map((format) => format.name);
            expect(formats).not.toContain('Magnum');
            expect(getNextBarcodeNumber(getBarcodeSettings())).toBe(nextNumber);

            const real = await (await importCsvFiles(files())).json();
            expect(real).toMatchObject({ dryRun: false, results: dryRun.results });
        });
    });
});
