import { beforeEach, describe, expect, it } from 'vitest';
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
    wineTypes
} from '#lib/server/db/schema.js';
import { EXPORT_TABLE_NAMES, EXPORT_TABLES } from '#lib/server/features/backup/export.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { IMAGES_URL_PATH } from '#lib/server/paths.js';
import { exportCsvFiles } from '../../../../test/csv-export';
import { fakeEvent } from '../../../../test/event';
import { POST as importCsv } from '../../../../routes/api/admin/import-csv/+server';
import { POST as postBottles } from '../../../../routes/api/bottles/+server';

const timestamps = { createdAt: new Date('2024-01-01T00:00:00Z'), updatedAt: new Date() };

/** Every table emptied, children first. */
function emptyCellar() {
    for (const name of [...EXPORT_TABLE_NAMES].reverse()) db.delete(EXPORT_TABLES[name]).run();
}

// Wines that only their colour or classification tells apart, and bottles without a barcode,
// out of the cellar or consumed: what a round trip through the CSV files used to lose or duplicate.
beforeEach(() => {
    emptyCellar();
    setAppSetting('barcode_auto_generation', 'false');
    db.insert(countries)
        .values({ id: 'c', name: 'Testland', ...timestamps })
        .run();
    db.insert(regions)
        .values({ id: 'r', name: 'Hillside', countryId: 'c', ...timestamps })
        .run();
    db.insert(appellations)
        .values({ id: 'a', name: 'Cru Alpha', regionId: 'r', ...timestamps })
        .run();
    db.insert(wineTypes)
        .values({ id: 't', type: 'Still', ...timestamps })
        .run();
    db.insert(wineColors)
        .values([
            { id: 'red', color: 'Red', ...timestamps },
            { id: 'white', color: 'White', ...timestamps }
        ])
        .run();
    db.insert(wineClassifications)
        .values({ id: 'gc', name: 'Grand Cru', ...timestamps })
        .run();
    db.insert(wineFormats)
        .values({ id: 'f', name: 'Bottle', ...timestamps })
        .run();
    db.insert(origins).values({ id: 'o', name: 'Wine shop', createdAt: new Date() }).run();
    db.insert(storageContainers)
        .values({ id: 'rack', name: 'Rack', ...timestamps })
        .run();
    db.insert(storageCases)
        // Not the default 0: the files carry the order of the cases.
        .values({
            id: 'rack1',
            name: 'Rack1',
            capacity: 6,
            position: 3,
            containerId: 'rack',
            ...timestamps
        })
        .run();
    db.insert(wineImages)
        .values({ id: 'img', filename: 'twin.jpg', path: IMAGES_URL_PATH, ...timestamps })
        .run();
    const twin = { name: 'Twin', producer: 'Maker', appellationId: 'a', typeId: 't' };
    db.insert(wineDefinitions)
        .values([
            {
                id: 'red-gc',
                ...twin,
                colorId: 'red',
                classificationId: 'gc',
                rating: 4.5,
                grapeVarieties: ['Syrah', 'Grenache'],
                imageId: 'img',
                ...timestamps
            },
            { id: 'red', ...twin, colorId: 'red', targetQuantity: 3, ...timestamps },
            { id: 'white', ...twin, colorId: 'white', ...timestamps }
        ])
        .run();
    const bottle = { formatId: 'f', ...timestamps };
    db.insert(wineBottles)
        .values([
            {
                id: 'b1',
                ...bottle,
                definitionId: 'red-gc',
                vintage: 2015,
                storageCaseId: 'rack1',
                barcode: 'RT0001',
                // Exported with a guard, so that a spreadsheet does not run it.
                notes: '=HYPERLINK("http://evil.example")'
            },
            {
                id: 'b2',
                ...bottle,
                definitionId: 'white',
                availability: 'consumed',
                consumedDate: new Date('2025-02-01T00:00:00Z'),
                barcode: 'RT0002'
            },
            // Two bottles alike: both are kept, and neither is added again.
            { id: 'b3', ...bottle, definitionId: 'red', availability: 'out_of_cellar' },
            { id: 'b4', ...bottle, definitionId: 'red', availability: 'out_of_cellar' },
            {
                id: 'b5',
                ...bottle,
                definitionId: 'white',
                vintage: 2020,
                originId: 'o',
                purchasePrice: 12.5,
                purchaseDate: new Date('2024-05-01T00:00:00Z'),
                notes: 'Gift, "special"\nsecond line'
            }
        ])
        .run();
});

const exportAll = () => exportCsvFiles(EXPORT_TABLE_NAMES);

/** The contents of the files, by table: an export leaves out the ids and the timestamps. */
async function contents(files: File[]): Promise<Record<string, string>> {
    const entries = await Promise.all(
        files.map(async (file) => [file.name.replace(/-\d{4}-.*$/, ''), await file.text()])
    );
    return Object.fromEntries(entries);
}

async function importAll(files: File[]) {
    const body = new FormData();
    for (const file of files) body.append('files', file);
    body.append('delimiter', ',');
    const response = await importCsv(
        fakeEvent<Parameters<typeof importCsv>[0]>({
            method: 'POST',
            path: '/api/admin/import-csv',
            routeId: '/api/admin/import-csv',
            body
        })
    );
    expect(response.status).toBe(200);
    return response.json();
}

function counts() {
    return Object.fromEntries(
        EXPORT_TABLE_NAMES.map((name) => [name, db.select().from(EXPORT_TABLES[name]).all().length])
    );
}

describe('CSV export then import', () => {
    it('puts the same cellar back in an empty database', async () => {
        const files = await exportAll();
        const exported = await contents(files);
        expect(exported['cellar-export-wineBottles']).toContain(
            `"'=HYPERLINK(""http://evil.example"")"`
        );
        emptyCellar();

        const { summary } = await importAll(files);

        expect(summary).toMatchObject({ totalSkipped: 0, totalFailed: 0 });
        expect(await contents(await exportAll())).toEqual(exported);
        expect(db.select().from(wineBottles).all()).toContainEqual(
            expect.objectContaining({
                barcode: 'RT0001',
                notes: '=HYPERLINK("http://evil.example")'
            })
        );
    });

    it('puts the same bottles back from a bottle file exported before 0.9.0, without typeName', async () => {
        const files = await exportAll();
        const bottleFile = files.find((file) => file.name.includes('wineBottles'))!;
        // Every wine of the fixture is Still: its typeName is the column between the
        // classification and the colour, and no other column holds ",Still,".
        const older = (await bottleFile.text()).replace('typeName,', '').replaceAll(',Still,', ',');
        expect(older).not.toContain('Still');
        emptyCellar();

        const { summary } = await importAll([
            ...files.filter((file) => file !== bottleFile),
            new File([older], bottleFile.name)
        ]);

        expect(summary).toMatchObject({ totalSkipped: 0, totalFailed: 0 });
        expect(await contents(await exportAll())).toEqual(await contents(files));
    });

    it('reads a wine file given twice in one import as one, whatever the case', async () => {
        const files = await exportAll();
        const wineFile = files.find((file) => file.name.includes('wineDefinitions'))!;
        const [header, ...rows] = (await wineFile.text()).split('\n');
        const shouted = [header, ...rows.map((row) => row.toUpperCase())].join('\n');
        emptyCellar();

        const { summary } = await importAll([...files, new File([shouted], wineFile.name)]);

        expect(summary).toMatchObject({ totalSkipped: 3, totalFailed: 0 });
        expect(await contents(await exportAll())).toEqual(await contents(files));
    });

    it('adds nothing when imported into the cellar it comes from', async () => {
        const before = counts();

        const { summary } = await importAll(await exportAll());

        expect(summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
        expect(counts()).toEqual(before);
    });

    // The import reads line breaks as LF (DATA-10): the cellar must hold them so too.
    it('adds nothing back from a note whose line breaks a script sent as CRLF', async () => {
        const created = await postBottles(
            fakeEvent<Parameters<typeof postBottles>[0]>({
                method: 'POST',
                path: '/api/bottles',
                routeId: '/api/bottles',
                body: {
                    definitionId: 'red',
                    formatId: 'f',
                    availability: 'consumed',
                    notes: 'First line\r\nSecond line'
                }
            })
        );
        expect(created.status).toBe(201);
        const before = counts();

        const { summary } = await importAll(await exportAll());

        expect(summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
        expect(counts()).toEqual(before);
    });

    // The API, the forms and the import count the same UTF-16 units, an emoji two (API-12).
    it('puts back whole a note and a description of 5,000 UTF-16 units with emoji', async () => {
        const text = '🍷'.repeat(2_499) + 'ab';
        const created = await postBottles(
            fakeEvent<Parameters<typeof postBottles>[0]>({
                method: 'POST',
                path: '/api/bottles',
                routeId: '/api/bottles',
                body: { definitionId: 'red', formatId: 'f', notes: text }
            })
        );
        expect(created.status).toBe(201);
        db.update(wineDefinitions)
            .set({ description: text })
            .where(eq(wineDefinitions.id, 'white'))
            .run();
        const files = await exportAll();
        emptyCellar();

        const { summary } = await importAll(files);

        expect(summary).toMatchObject({ totalSkipped: 0, totalFailed: 0 });
        expect(db.select().from(wineBottles).all()).toContainEqual(
            expect.objectContaining({ notes: text })
        );
        expect(db.select().from(wineDefinitions).all()).toContainEqual(
            expect.objectContaining({ description: text })
        );
    });

    it('adds nothing from its next export once barcodes were given to the bottles without one', async () => {
        const files = await exportAll();
        emptyCellar();
        setAppSetting('barcode_prefix', 'RTG');
        setAppSetting('barcode_auto_generation', 'true');
        await importAll(files);
        const imported = counts();

        const { summary } = await importAll(await exportAll());

        expect(summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
        expect(counts()).toEqual(imported);
    });
});

/** Two wines named Bubbles, alike but for `apart`, with `bottles` bottles each. */
function insertBubbles(apart: [object, object], bottles: [number, number]) {
    db.insert(wineTypes)
        .values([
            { id: 'champagne', type: 'Champagne', ...timestamps },
            { id: 'sparkling', type: 'Sparkling', ...timestamps }
        ])
        .run();
    const bubbles = { name: 'Bubbles', producer: 'Maker', appellationId: 'a', colorId: 'white' };
    db.insert(wineDefinitions)
        .values([
            { id: 'bubbles-1', ...bubbles, typeId: 'champagne', ...apart[0], ...timestamps },
            { id: 'bubbles-2', ...bubbles, typeId: 'champagne', ...apart[1], ...timestamps }
        ])
        .run();
    db.insert(wineBottles)
        .values(
            (['bubbles-1', 'bubbles-2'] as const).flatMap((definitionId, wine) =>
                Array.from({ length: bottles[wine] }, (_, i) => ({
                    id: `${definitionId}-${i}`,
                    definitionId,
                    formatId: 'f',
                    ...timestamps
                }))
            )
        )
        .run();
}

/** The number of bottles of each wine named Bubbles, by its type. */
function bubblesByType() {
    const types = new Map(
        db
            .select()
            .from(wineTypes)
            .all()
            .map((row) => [row.id, row.type])
    );
    const bottles = db.select().from(wineBottles).all();
    return Object.fromEntries(
        db
            .select()
            .from(wineDefinitions)
            .all()
            .filter((wine) => wine.name === 'Bubbles')
            .map((wine) => [
                types.get(wine.typeId),
                bottles.filter((bottle) => bottle.definitionId === wine.id).length
            ])
    );
}

/** The number of bottles of each wine named Bubbles: one number per wine. */
function bottlesOfBubbles() {
    const bottles = db.select().from(wineBottles).all();
    return db
        .select()
        .from(wineDefinitions)
        .where(eq(wineDefinitions.name, 'Bubbles'))
        .all()
        .map((wine) => bottles.filter((bottle) => bottle.definitionId === wine.id).length);
}

/** The problems of each row left out of the file of `table`, in an import report. */
function problemsOf(
    results: { table: string; errors: { problems: unknown[] }[] }[],
    table: string
) {
    return results
        .find((report) => report.table.startsWith(table))!
        .errors.map((error) => error.problems);
}

describe('CSV export then import of wines alike in every exported column of their key', () => {
    it('keeps apart two wines that only their type tells apart', async () => {
        insertBubbles([{}, { typeId: 'sparkling' }], [2, 3]);
        const files = await exportAll();
        emptyCellar();

        const { summary } = await importAll(files);

        expect(summary).toMatchObject({ totalSkipped: 0, totalFailed: 0 });
        expect(bubblesByType()).toEqual({ Champagne: 2, Sparkling: 3 });
    });

    it('adds no bottle to two wines that only their type tells apart, imported into their cellar', async () => {
        insertBubbles([{}, { typeId: 'sparkling' }], [2, 3]);

        const { summary } = await importAll(await exportAll());

        expect(summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
        expect(bubblesByType()).toEqual({ Champagne: 2, Sparkling: 3 });
    });

    const twinsApartBy = [
        ['rating', [{ rating: 3 }, { rating: 5 }]],
        ['description', [{ description: 'Brut' }, { description: 'Extra brut' }]],
        ['image', [{ imageId: 'img' }, {}]]
    ] as const;

    it.each(twinsApartBy)(
        'imports both wines that only their %s tells apart, and reports their bottles',
        async (_, apart) => {
            insertBubbles([...apart], [1, 2]);
            const files = await exportAll();
            emptyCellar();

            const { results } = await importAll(files);

            expect(problemsOf(results, 'wineBottles')).toEqual(
                Array(3).fill([{ code: 'several_wines', name: 'Bubbles' }])
            );
            expect(bottlesOfBubbles()).toEqual([0, 0]);
        }
    );

    it.each(twinsApartBy)(
        'reports the bottles of two wines that only their %s tells apart, imported after the wines',
        async (_, apart) => {
            insertBubbles([...apart], [1, 2]);
            const files = await exportAll();
            const bottleFile = files.find((file) => file.name.includes('wineBottles'))!;
            emptyCellar();
            await importAll(files.filter((file) => file !== bottleFile));

            const { results } = await importAll([bottleFile]);

            expect(problemsOf(results, 'wineBottles')).toEqual(
                Array(3).fill([{ code: 'several_wines', name: 'Bubbles' }])
            );
            expect(bottlesOfBubbles()).toEqual([0, 0]);
        }
    );

    it('adds no wine when the wine file is imported again, even once a wine was changed', async () => {
        insertBubbles([{ rating: 3 }, { rating: 5 }], [1, 1]);
        const files = await exportAll();
        const wineFile = files.find((file) => file.name.includes('wineDefinitions'))!;
        emptyCellar();
        await importAll(files.filter((file) => !file.name.includes('wineBottles')));
        db.update(wineDefinitions).set({ rating: 4 }).where(eq(wineDefinitions.rating, 3)).run();

        const { summary } = await importAll([wineFile]);

        expect(summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
        expect(bottlesOfBubbles()).toEqual([0, 0]);
    });

    // Its rows may stand for that wine as it was when exported: adding one would duplicate it.
    it('adds no wine of a key that the cellar had before the import', async () => {
        insertBubbles([{ rating: 3 }, { rating: 5 }], [1, 0]);
        const wineFile = (await exportAll()).find((file) => file.name.includes('wineDefinitions'))!;
        db.delete(wineDefinitions).where(eq(wineDefinitions.id, 'bubbles-2')).run();

        const { summary } = await importAll([wineFile]);

        expect(summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
        expect(bottlesOfBubbles()).toEqual([1]);
    });

    it('matches a hand-made bottle file whose type and region are blank to the one wine it names', async () => {
        insertBubbles([{}, { typeId: 'sparkling', producer: 'Other maker' }], [1, 1]);

        const { results } = await importAll([
            new File(
                [
                    'wineName,producer,regionName,appellationName,classificationName,typeName,colorName,formatName,vintage\n' +
                        'Bubbles,Maker,,Cru Alpha,,,White,Bottle,2019\n'
                ],
                'wineBottles.csv'
            )
        ]);

        expect(results[0]).toMatchObject({ successfulImports: 1, errors: [] });
        expect(bubblesByType()).toEqual({ Champagne: 2, Sparkling: 1 });
    });

    it('reports the bottles of a file exported without the type, which names either wine', async () => {
        insertBubbles([{}, { typeId: 'sparkling' }], [2, 3]);

        const { results } = await importAll([
            new File(
                [
                    'wineName,producer,appellationName,classificationName,colorName,formatName\n' +
                        'Bubbles,Maker,Cru Alpha,,White,Bottle\n'
                ],
                'cellar-export-wineBottles-2025-01-01.csv'
            )
        ]);

        expect(results[0].errors).toEqual([
            { row: 1, problems: [{ code: 'several_wines', name: 'Bubbles' }] }
        ]);
        expect(bubblesByType()).toEqual({ Champagne: 2, Sparkling: 3 });
    });
});

describe('CSV export then import of the cases', () => {
    /** The case of each bottle in one, as container and case names, by vintage. */
    function placeOfBottles() {
        const containers = new Map(
            db
                .select()
                .from(storageContainers)
                .all()
                .map((row) => [row.id, row.name])
        );
        const cases = new Map(
            db
                .select()
                .from(storageCases)
                .all()
                .map((row) => [row.id, `${containers.get(row.containerId)} / ${row.name}`])
        );
        return Object.fromEntries(
            db
                .select()
                .from(wineBottles)
                .all()
                .filter((bottle) => bottle.storageCaseId)
                .map((bottle) => [bottle.vintage, cases.get(bottle.storageCaseId!)])
        );
    }

    // Containers A1 and A, with suffixes 1 and 11, both have a case named A11.
    it('puts each bottle back in its case when two containers have cases of the same name', async () => {
        db.insert(storageContainers)
            .values([
                { id: 'a', name: 'A', ...timestamps },
                { id: 'a1', name: 'A1', ...timestamps }
            ])
            .run();
        db.insert(storageCases)
            .values([
                { id: 'a-11', name: 'A11', capacity: 6, containerId: 'a', ...timestamps },
                { id: 'a1-1', name: 'A11', capacity: 6, containerId: 'a1', ...timestamps }
            ])
            .run();
        db.update(wineBottles).set({ storageCaseId: 'a1-1' }).where(eq(wineBottles.id, 'b1')).run();
        db.update(wineBottles).set({ storageCaseId: 'a-11' }).where(eq(wineBottles.id, 'b5')).run();
        const before = placeOfBottles();
        expect(before).toEqual({ 2015: 'A1 / A11', 2020: 'A / A11' });
        const files = await exportAll();
        emptyCellar();

        const { summary } = await importAll(files);

        expect(summary).toMatchObject({ totalSkipped: 0, totalFailed: 0 });
        expect(placeOfBottles()).toEqual(before);
    });

    it('places a case added to a container that has cases after them, unless the file says where', async () => {
        db.update(storageContainers)
            .set({ updatedAt: new Date(0) })
            .run();

        const { results } = await importAll([
            new File(
                ['name,capacity,containerName,position\nRack9,6,Rack,\nRack7,6,Rack,1\n'],
                'storageCases.csv'
            )
        ]);

        expect(results[0]).toMatchObject({ successfulImports: 2, errors: [] });
        const positions = Object.fromEntries(
            db
                .select()
                .from(storageCases)
                .all()
                .map((row) => [row.name, row.position])
        );
        // Rack1, at position 3, was the last case of Rack.
        expect(positions).toMatchObject({ Rack1: 3, Rack9: 4, Rack7: 1 });
        // A draft of Rack opened before the import is refused: it would delete the cases added.
        const [rack] = db.select().from(storageContainers).all();
        expect(rack.updatedAt.getTime()).toBeGreaterThan(0);
    });
});
