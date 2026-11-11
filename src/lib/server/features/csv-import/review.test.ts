import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    csvImportChoices,
    producers,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineColors,
    wineDefinitions,
    wineFormats,
    wineTypes
} from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { exportCsvFiles } from '../../../../test/csv-export';
import { failWrites } from '../../../../test/failing-write';
import { csvImportForm, importCsv } from './service';

const at = { createdAt: new Date(), updatedAt: new Date() };

/** A cellar with two wines that a bottle file cannot tell apart. */
async function seed() {
    for (const table of [
        wineBottles,
        wineDefinitions,
        producers,
        storageCases,
        storageContainers
    ]) {
        await db.delete(table);
    }
    await db.delete(csvImportChoices);
    // What the reviews of earlier tests created.
    await db.delete(appellations).where(eq(appellations.regionId, 'bourgogne'));
    await db
        .insert(countries)
        .values({ id: 'fr', name: 'France', ...at })
        .onConflictDoNothing();
    await db
        .insert(regions)
        .values([
            { id: 'bourgogne', name: 'Bourgogne', countryId: 'fr', ...at },
            { id: 'loire', name: 'Loire', countryId: 'fr', ...at }
        ])
        .onConflictDoNothing();
    await db
        .insert(appellations)
        .values([
            { id: 'beaune', name: 'Beaune', regionId: 'bourgogne', ...at },
            { id: 'bourgogne-ac', name: 'Bourgogne', regionId: 'bourgogne', ...at },
            { id: 'sancerre', name: 'Sancerre', regionId: 'loire', ...at }
        ])
        .onConflictDoNothing();
    await db
        .insert(wineTypes)
        .values({ id: 'still', type: 'Still', ...at })
        .onConflictDoNothing();
    await db
        .insert(wineColors)
        .values([
            { id: 'red', color: 'Red', ...at },
            { id: 'white', color: 'White', ...at }
        ])
        .onConflictDoNothing();
    await db
        .insert(wineFormats)
        .values({ id: '75', name: '75 cl', ...at })
        .onConflictDoNothing();
    await db.insert(producers).values([
        { id: 'drouhin', name: 'Joseph Drouhin', ...at },
        { id: 'leflaive', name: 'Domaine Leflaive', ...at }
    ]);
    const mouches = {
        name: 'Clos des Mouches',
        producerId: 'drouhin',
        appellationId: 'beaune',
        typeId: 'still',
        colorId: 'red',
        ...at
    };
    await db.insert(wineDefinitions).values([
        { id: 'mouches-3', ...mouches, rating: 3 },
        { id: 'mouches-5', ...mouches, rating: 5 }
    ]);
    await db.insert(storageContainers).values({ id: 'cave', name: 'Cave', ...at });
    await db
        .insert(storageCases)
        .values({ id: 'c1', name: 'Cave1', containerId: 'cave', capacity: 24, position: 1, ...at });
    await db.insert(wineBottles).values({
        id: 'b1',
        definitionId: 'mouches-5',
        formatId: '75',
        barcode: 'OLD-1',
        availability: 'available',
        ...at
    });
}

const WINES = [
    'name,producer,appellationName,regionName,typeName,colorName',
    'Les Monts Damnés,Henri Bourgeois,Sancerre,Loire,Still,White',
    'Plan de Dieu,Domaine Brusset,Côtes du Rhône Villages Plan de Dieux,,Still,Red',
    'Bourgogne Blanc,Dom. Leflaive,Bourgogne,Bourgogne,Still,White',
    'Les Monts Damnés,Henri Bourgeois,Sancerre,Loire,Still,White'
].join('\n');

const BOTTLES = [
    'wineName,producer,appellationName,typeName,colorName,formatName,vintage,purchasePrice,barcode',
    'Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,2018,,',
    'Les Monts Damnés,Henri Bourgeois,Sancerre,Still,White,75 cl,2O21,,',
    'Les Monts Damnés,Henri Bourgeois,Sancerre,Still,White,75 cl,2021,"12,50 €",',
    'Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,2015,,OLD-1',
    'Plan de Dieu,Domaine Brusset,Côtes du Rhône Villages Plan de Dieux,Still,Red,75 cl,2020,,',
    'Les Monts Damnés,,,,,,,,'
].join('\n');

type Answer = Record<string, unknown>;

function check(choices: object | undefined, dryRun = true, files = { WINES, BOTTLES }) {
    return importCsv(
        csvImportForm.parse({
            files: [
                new File([files.WINES], 'wineDefinitions.csv'),
                new File([files.BOTTLES], 'wineBottles.csv')
            ],
            dryRun: String(dryRun),
            ...(choices && { choices: JSON.stringify(choices) })
        })
    );
}

/** The issues of a check, by the text they are about. */
async function issuesOf(choices: object = {}, files = { WINES, BOTTLES }) {
    const answer = await check(choices, true, files);
    return Object.fromEntries(
        answer.review!.issues.map((issue) => [issue.value ?? '', issue] as const)
    );
}

/** The answers that settle every problem of the made-up files. */
async function settlingAnswers(): Promise<Record<string, Answer>> {
    const issues = await issuesOf();
    return {
        [issues['Côtes du Rhône Villages Plan de Dieux'].key]: {
            action: 'create',
            value: 'Côtes du Rhône Villages Plan de Dieu',
            parent: 'Bourgogne'
        },
        [issues['Dom. Leflaive'].key]: { action: 'set', value: 'Domaine Leflaive' },
        [issues['Clos des Mouches'].key]: { action: 'wine', wine: { id: 'mouches-5' } },
        [issues['2O21'].key]: { action: 'set', value: '2021' },
        [issues['12,50 €'].key]: { action: 'set', value: '12.50' },
        [issues[''].key]: { action: 'set', value: '75 cl' }
    };
}

const bottlesOf = (wine: string) =>
    db.select().from(wineBottles).where(eq(wineBottles.definitionId, wine));

describe('review of a CSV import', () => {
    beforeEach(seed);

    it('lists each problem once, with its rows, and what can settle it', async () => {
        const answer = await check({});
        const issues = Object.fromEntries(
            answer.review!.issues.map((i) => [i.value ?? '', i] as const)
        );

        expect(answer.review!.open).toBe(true);
        expect(issues['Clos des Mouches']).toMatchObject({
            kind: 'wine',
            open: true,
            problem: { code: 'several_wines' },
            // Row 4 is a bottle that one of the two wines has: already in the cellar.
            count: 1,
            rows: [{ file: 'wineBottles.csv', row: 1 }]
        });
        expect(issues['Clos des Mouches'].wines!.map((wine) => wine.wine)).toEqual([
            { id: 'mouches-3' },
            { id: 'mouches-5' }
        ]);
        expect(issues['Côtes du Rhône Villages Plan de Dieux']).toMatchObject({
            kind: 'reference',
            target: 'appellations',
            parentTarget: 'regions',
            creatable: true,
            problem: { code: 'unknown_reference' }
        });
        expect(issues['Dom. Leflaive']).toMatchObject({
            kind: 'reference',
            target: 'producers',
            close: ['Domaine Leflaive'],
            problem: { code: 'similar_name', similar: ['Domaine Leflaive'] }
        });
        expect(issues['2O21']).toMatchObject({ kind: 'cell', column: 'vintage', required: false });
        expect(issues['12,50 €']).toMatchObject({ kind: 'cell', column: 'purchasePrice' });
        expect(issues['']).toMatchObject({
            kind: 'reference',
            column: 'formatName',
            required: true,
            problem: { code: 'missing' }
        });
        // The bottles of a wine row that is itself to settle say so.
        expect(issues['Plan de Dieu']).toMatchObject({
            kind: 'wine',
            problem: { code: 'unknown_wine' },
            pending: { file: 'wineDefinitions.csv', row: 2 }
        });
        expect(answer.review!.names.appellations).toContainEqual({
            name: 'Sancerre',
            parent: 'Loire'
        });
        // The parents of a table whose rows can be created, for « create » to ask.
        expect(answer.review!.names.regions).toContainEqual({ name: 'Loire', parent: 'France' });
    });

    it('imports every row once each problem is answered, the bottles of a wine row included', async () => {
        const answers = await settlingAnswers();

        const checked = await check(answers);
        expect(checked.review!.open).toBe(false);
        expect(checked.review!.issues.every((issue) => !issue.open)).toBe(true);

        const written = await check(answers, false);

        expect(written.summary).toMatchObject({
            totalImported: 3 + 5,
            totalFailed: 0,
            totalIgnored: 0
        });
        const [created] = await db
            .select()
            .from(appellations)
            .where(eq(appellations.name, 'Côtes du Rhône Villages Plan de Dieu'));
        expect(created.regionId).toBe('bourgogne');
        const [planDeDieu] = await db
            .select()
            .from(wineDefinitions)
            .where(eq(wineDefinitions.name, 'Plan de Dieu'));
        expect(planDeDieu.appellationId).toBe(created.id);
        // Its bottle, which named the appellation as the file did, went to it.
        expect(await bottlesOf(planDeDieu.id)).toHaveLength(1);
        const [bourgogne] = await db
            .select()
            .from(wineDefinitions)
            .where(eq(wineDefinitions.name, 'Bourgogne Blanc'));
        expect(bourgogne.producerId).toBe('leflaive');
        const mouches = await bottlesOf('mouches-5');
        expect(mouches.map((bottle) => bottle.vintage).toSorted()).toEqual([2018, null]);
        const sancerre = await db
            .select()
            .from(wineBottles)
            .innerJoin(wineDefinitions, eq(wineBottles.definitionId, wineDefinitions.id))
            .where(eq(wineDefinitions.name, 'Les Monts Damnés'));
        expect(sancerre.map(({ wine_bottles: b }) => [b.vintage, b.purchasePrice])).toEqual(
            expect.arrayContaining([
                [2021, null],
                [2021, 12.5],
                [null, null]
            ])
        );
    });

    it('leaves blank an optional cell answered so', async () => {
        const issues = await issuesOf();

        const answer = await check({ [issues['2O21'].key]: { action: 'set', value: '' } });

        expect(answer.review!.issues.find((issue) => issue.value === '2O21')!.open).toBe(false);
    });

    it('ignores the rows of an issue answered so, and gives them back as read', async () => {
        const answers = await settlingAnswers();
        const issues = await issuesOf();
        answers[issues['12,50 €'].key] = { action: 'ignore' };

        const written = await check(answers, false);

        const bottles = written.results.find((result) => result.table === 'wineBottles')!;
        expect(bottles.ignoredImports).toBe(1);
        expect(bottles.columns[7]).toBe('purchasePrice');
        expect(bottles.ignored).toEqual([
            {
                row: 3,
                key: issues['12,50 €'].key,
                values: [
                    'Les Monts Damnés',
                    'Henri Bourgeois',
                    'Sancerre',
                    'Still',
                    'White',
                    '75 cl',
                    '2021',
                    '12,50 €',
                    ''
                ]
            }
        ]);
        expect(written.summary.totalIgnored).toBe(1);
    });

    it('ignores every problem left when told to, and one row alone', async () => {
        const answer = await check({
            '*': { action: 'ignore' },
            [JSON.stringify(['row', 'wineDefinitions.csv', 1])]: { action: 'ignore' }
        });

        expect(answer.review!.open).toBe(false);
        expect(answer.summary.totalFailed).toBe(0);
        const wines = answer.results.find((result) => result.table === 'wineDefinitions')!;
        expect(wines.ignored.map(({ row }) => row)).toEqual([1, 2, 3]);
    });

    it('refuses an answer other than ignore for every problem left', () => {
        expect(() =>
            csvImportForm.parse({
                files: [new File(['name\n'], 'countries.csv')],
                choices: JSON.stringify({ '*': { action: 'set', value: 'x' } })
            })
        ).toThrow();
    });

    it('imports anyway a bottle the cellar has, without the barcode it already gives', async () => {
        const answers = await settlingAnswers();
        const row = JSON.stringify(['row', 'wineBottles.csv', 4]);

        const kept = await check({ ...answers, [row]: { action: 'import' } }, false);

        const bottles = kept.results.find((result) => result.table === 'wineBottles')!;
        expect(bottles.skipped).toEqual([
            { row: 4, reason: { code: 'same_barcode', barcode: 'OLD-1' }, imported: true }
        ]);
        expect(bottles.skippedImports).toBe(0);
        const mouches = await bottlesOf('mouches-5');
        expect(mouches.filter((bottle) => bottle.vintage === 2015)).toMatchObject([
            { barcode: null }
        ]);
        expect(mouches.filter((bottle) => bottle.barcode === 'OLD-1')).toHaveLength(1);
    });

    it('writes nothing while a row is to settle', async () => {
        const answers = await settlingAnswers();
        delete answers[(await issuesOf())['2O21'].key];

        await expect(check(answers, false)).rejects.toMatchObject({
            status: 409,
            code: 'rows_to_settle'
        });

        expect(await db.select().from(wineDefinitions)).toHaveLength(2);
        expect(await db.select().from(csvImportChoices)).toEqual([]);
    });

    it('writes nothing when the database refuses a row of the review', async () => {
        const answers = await settlingAnswers();
        failWrites('INSERT', 'wine_bottles', 'NEW.purchase_price = 12.5');

        await expect(check(answers, false)).rejects.toMatchObject({
            status: 409,
            code: 'import_row_refused'
        });

        expect(await db.select().from(wineDefinitions)).toHaveLength(2);
        const created = eq(appellations.name, 'Côtes du Rhône Villages Plan de Dieu');
        expect(await db.select().from(appellations).where(created)).toEqual([]);
        expect(await db.select().from(csvImportChoices)).toEqual([]);
    });

    it('suggests the choices of an earlier import, without applying them', async () => {
        await check(await settlingAnswers(), false);

        // Another bottle of Clos des Mouches: the first one is now in the cellar.
        const issues = await issuesOf({}, { WINES, BOTTLES: BOTTLES.replace('2018', '2019') });

        expect(issues['Clos des Mouches']).toMatchObject({
            open: true,
            suggestion: { action: 'wine', wine: { id: 'mouches-5' } }
        });
        expect(issues['Clos des Mouches'].answer).toBeUndefined();
        expect(issues['2O21'].suggestion).toEqual({ action: 'set', value: '2021' });
        expect(issues[''].suggestion).toEqual({ action: 'set', value: '75 cl' });
        // The appellation created under another name is suggested for the name of the file.
        expect(issues['Côtes du Rhône Villages Plan de Dieux'].suggestion).toEqual({
            action: 'set',
            value: 'Côtes du Rhône Villages Plan de Dieu',
            parent: 'Bourgogne'
        });
    });

    it('suggests no choice whose row was deleted since', async () => {
        await check(await settlingAnswers(), false);
        await db.delete(wineBottles).where(eq(wineBottles.definitionId, 'mouches-5'));
        await db.delete(wineDefinitions).where(eq(wineDefinitions.id, 'mouches-5'));

        const issues = await issuesOf();

        expect(issues['Clos des Mouches']).toBeUndefined();
        // One wine is left: the bottles go to it, nothing to settle.
    });

    it('answers a request without choices as before the review', async () => {
        const answer = await check(undefined);

        expect(answer).not.toHaveProperty('review');
        expect(answer.summary).toMatchObject({ totalFailed: 6, totalIgnored: 0 });
        // A producer close to one of the cellar is created, as before.
        const bottles = answer.results.find((result) => result.table === 'wineBottles')!;
        expect(bottles.errors.map(({ row }) => row)).toEqual([1, 2, 3, 5, 6]);
    });

    it('has nothing to settle in its own CSV export', async () => {
        // The bottles of twins, two wines that differ only by their rating, are already in the
        // cellar: the file cannot tell their wines apart (BUG-18), but one of them has each.
        await check(await settlingAnswers(), false);
        const files = await exportCsvFiles([
            'countries',
            'regions',
            'appellations',
            'wineTypes',
            'wineColors',
            'wineFormats',
            'producers',
            'storageContainers',
            'storageCases',
            'wineDefinitions',
            'wineBottles'
        ]);

        const answer = await importCsv(
            csvImportForm.parse({ files, dryRun: 'true', choices: '{}' })
        );

        expect(answer.review!.issues.map(({ key, problem }) => [key, problem])).toEqual([]);
        expect(answer.summary).toMatchObject({ totalImported: 0, totalFailed: 0 });
    });
});

describe('the answers of a review', () => {
    beforeEach(seed);

    const BOTTLE_HEADER =
        'wineName,producer,appellationName,typeName,colorName,formatName,vintage,barcode,containerName,storageCaseName';
    const bottleFile = (...rows: string[]) => ({
        WINES: 'name\n',
        BOTTLES: [BOTTLE_HEADER, ...rows].join('\n')
    });
    const issueOf = async (choices: object, files: { WINES: string; BOTTLES: string }) =>
        (await check(choices, true, files)).review!.issues;

    it('counts a row once when its answer does not settle it', async () => {
        const vintage = (await issuesOf())['2O21'];

        const issues = await issuesOf({ [vintage.key]: { action: 'set', value: '2O21' } });

        expect(issues['2O21']).toMatchObject({ open: true, count: 1 });
        expect(issues['2O21'].rows).toEqual([{ file: 'wineBottles.csv', row: 2 }]);
    });

    it('keeps on the same card a correction that is still not valid', async () => {
        const vintage = (await issuesOf())['2O21'];

        const issues = await issuesOf({ [vintage.key]: { action: 'set', value: '2O22' } });

        expect(issues['2O21']).toMatchObject({
            open: true,
            count: 1,
            answer: { action: 'set', value: '2O22' },
            problem: { code: 'invalid', column: 'vintage' }
        });
        expect(issues['2O22']).toBeUndefined();
    });

    it('keeps on the same card a value that is still unknown, with its close names', async () => {
        const producer = (await issuesOf())['Dom. Leflaive'];

        const issues = await issuesOf({
            [producer.key]: { action: 'set', value: 'Domaine Lefaive' }
        });

        expect(issues['Dom. Leflaive']).toMatchObject({
            open: true,
            count: 1,
            close: ['Domaine Leflaive'],
            problem: { column: 'producer', name: 'Domaine Lefaive' }
        });
        expect(issues['Domaine Lefaive']).toBeUndefined();
    });

    it('keeps on the same card a name that cannot be created, with why', async () => {
        const appellation = (await issuesOf())['Côtes du Rhône Villages Plan de Dieux'];

        const issues = await issuesOf({
            [appellation.key]: { action: 'create', value: 'Plan de Dieu', parent: 'Atlantis' }
        });

        expect(issues['Côtes du Rhône Villages Plan de Dieux']).toMatchObject({
            open: true,
            problem: { code: 'unknown_reference', column: 'regionName', name: 'Atlantis' }
        });
    });

    it('places the bottles that a full case cannot hold where its answer says, or ignores them', async () => {
        await db.insert(storageCases).values([
            { id: 'small', name: 'Small', containerId: 'cave', capacity: 1, position: 2, ...at },
            { id: 'big', name: 'Big', containerId: 'cave', capacity: 10, position: 3, ...at }
        ]);
        const row = (vintage: number) =>
            `Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,${vintage},,Cave,Small`;
        const files = bottleFile(row(2010), row(2011), row(2012));
        const wine = (await issueOf({}, files)).find((issue) => issue.kind === 'wine')!;
        const answers = { [wine.key]: { action: 'wine', wine: { id: 'mouches-3' } } };

        const full = (await issueOf(answers, files)).find(
            (issue) => issue.problem?.code === 'case_full'
        )!;
        expect(full).toMatchObject({
            open: true,
            count: 2,
            creatable: false,
            target: 'storageCases'
        });

        const moved = await check(
            { ...answers, [full.key]: { action: 'set', value: 'Big', parent: 'Cave' } },
            false,
            files
        );
        expect(moved.summary).toMatchObject({ totalImported: 3, totalIgnored: 0 });
        const cases = (await bottlesOf('mouches-3')).map((bottle) => bottle.storageCaseId);
        expect(cases.toSorted()).toEqual(['big', 'big', 'small']);

        await seed();
        await db
            .insert(storageCases)
            .values([
                { id: 'small', name: 'Small', containerId: 'cave', capacity: 1, position: 2, ...at }
            ]);
        const ignored = await check({ ...answers, [full.key]: { action: 'ignore' } }, true, files);
        expect(ignored.summary).toMatchObject({ totalImported: 1, totalIgnored: 2 });
    });

    it('keeps on the card of a full case an answer that takes another full case', async () => {
        await db.insert(storageCases).values([
            { id: 'small', name: 'Small', containerId: 'cave', capacity: 1, position: 2, ...at },
            { id: 'mid', name: 'Mid', containerId: 'cave', capacity: 1, position: 3, ...at }
        ]);
        const row = (vintage: number) =>
            `Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,${vintage},,Cave,Small`;
        const files = bottleFile(row(2010), row(2011), row(2012));
        const wine = (await issueOf({}, files)).find((issue) => issue.kind === 'wine')!;
        const answers = { [wine.key]: { action: 'wine', wine: { id: 'mouches-3' } } };
        const full = (await issueOf(answers, files)).find(
            (issue) => issue.problem?.code === 'case_full'
        )!;

        const issues = await issueOf(
            { ...answers, [full.key]: { action: 'set', value: 'Mid', parent: 'Cave' } },
            files
        );

        const fulls = issues.filter((issue) => issue.problem?.code === 'case_full');
        expect(fulls).toMatchObject([{ key: full.key, open: true, count: 2 }]);
    });

    it('ignores a file whose name names no table when told to', async () => {
        const send = (choices: object) =>
            importCsv(
                csvImportForm.parse({
                    files: [new File(['name\nFrance\n'], 'notes.csv')],
                    dryRun: 'true',
                    choices: JSON.stringify(choices)
                })
            );
        const { review } = await send({});
        const [file] = review!.issues;
        expect(file).toMatchObject({
            kind: 'row',
            table: null,
            open: true,
            problem: { code: 'no_table' }
        });

        const ignored = await send({ [file.key]: { action: 'ignore' } });

        expect(ignored.review!.open).toBe(false);
        expect(ignored.summary.totalFailed).toBe(0);
    });

    it('puts bottles in the wine of a row of the import, then keeps that wine by its id', async () => {
        const files = {
            WINES: [
                'name,producer,appellationName,typeName,colorName,rating',
                'Twin,Joseph Drouhin,Beaune,Still,Red,2',
                'Twin,Joseph Drouhin,Beaune,Still,Red,4'
            ].join('\n'),
            BOTTLES: [BOTTLE_HEADER, 'Twin,Joseph Drouhin,Beaune,Still,Red,75 cl,2019,,,'].join(
                '\n'
            )
        };
        const wine = (await issueOf({}, files)).find((issue) => issue.kind === 'wine')!;
        expect(wine.wines!.map((option) => option.wine)).toEqual([
            { file: 'wineDefinitions.csv', row: 1 },
            { file: 'wineDefinitions.csv', row: 2 }
        ]);

        await check(
            { [wine.key]: { action: 'wine', wine: { file: 'wineDefinitions.csv', row: 2 } } },
            false,
            files
        );

        const [rated4] = await db
            .select()
            .from(wineDefinitions)
            .where(eq(wineDefinitions.rating, 4));
        expect(await bottlesOf(rated4.id)).toHaveLength(1);
        const [kept] = await db
            .select()
            .from(csvImportChoices)
            .where(eq(csvImportChoices.key, wine.key));
        expect(JSON.parse(kept.answer)).toEqual({ id: rated4.id });
    });

    it('creates a producer close to one of the cellar when told to', async () => {
        const answers = await settlingAnswers();
        const issues = await issuesOf();
        answers[issues['Dom. Leflaive'].key] = { action: 'create', value: 'Dom. Leflaive' };

        await check(answers, false);

        expect(
            await db.select().from(producers).where(eq(producers.name, 'Dom. Leflaive'))
        ).toHaveLength(1);
    });

    it('gives a bottle imported anyway the next automatic barcode, when they are on', async () => {
        setAppSetting('barcode_auto_generation', 'true');
        onTestFinished(() => {
            setAppSetting('barcode_auto_generation', 'false');
        });
        const answers = await settlingAnswers();
        const row = JSON.stringify(['row', 'wineBottles.csv', 4]);

        await check({ ...answers, [row]: { action: 'import' } }, false);

        const bottle = (await bottlesOf('mouches-5')).find((b) => b.vintage === 2015)!;
        expect(bottle.barcode).toMatch(/\d+$/);
        expect(bottle.barcode).not.toBe('OLD-1');
    });

    it('leaves in the cellar the bottles of twins that either has, when the others are ignored', async () => {
        await db.insert(wineBottles).values({
            id: 'b2',
            definitionId: 'mouches-3',
            formatId: '75',
            vintage: 2016,
            availability: 'available',
            ...at
        });
        const row = (vintage: number) =>
            `Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,${vintage},,,`;
        const files = bottleFile(row(2016), row(2018), row(2019));
        const wine = (await issueOf({}, files)).find((issue) => issue.kind === 'wine')!;
        expect(wine.count).toBe(2);

        const answer = await check({ [wine.key]: { action: 'ignore' } }, true, files);

        expect(answer.summary).toMatchObject({ totalSkipped: 1, totalIgnored: 2 });
        expect(answer.review!.issues.find((issue) => issue.key === wine.key)!.count).toBe(2);
    });

    it('leaves in the cellar the bottles of twins that either has, when the wine is answered', async () => {
        await db.insert(wineBottles).values({
            id: 'b2',
            definitionId: 'mouches-3',
            formatId: '75',
            vintage: 2016,
            availability: 'available',
            ...at
        });
        const row = (vintage: number) =>
            `Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,${vintage},,,`;
        const files = bottleFile(row(2018), row(2016));
        const wine = (await issueOf({}, files)).find((issue) => issue.kind === 'wine')!;

        const written = await check(
            { [wine.key]: { action: 'wine', wine: { id: 'mouches-5' } } },
            false,
            files
        );

        expect(written.summary).toMatchObject({ totalImported: 1, totalSkipped: 1 });
        expect((await bottlesOf('mouches-5')).map((bottle) => bottle.vintage).toSorted()).toEqual([
            2018,
            null
        ]);
    });
});

describe('the bottles of twin wines', () => {
    beforeEach(seed);

    const file = (row: string) => ({
        WINES: 'name\n',
        BOTTLES:
            'wineName,producer,appellationName,typeName,colorName,formatName,vintage,barcode\n' +
            row
    });

    it('are already in the cellar when one of the twins has them, for scripts too', async () => {
        await db.insert(wineBottles).values({
            id: 'b2',
            definitionId: 'mouches-3',
            formatId: '75',
            vintage: 2016,
            availability: 'available',
            ...at
        });
        const rows = [
            'Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,2015,OLD-1',
            'Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,2016,'
        ].join('\n');

        for (const choices of [undefined, {}]) {
            const answer = await check(choices, true, file(rows));
            const bottles = answer.results.find((result) => result.table === 'wineBottles')!;
            expect(bottles.errors).toEqual([]);
            expect(bottles.skipped.map(({ reason }) => reason)).toEqual([
                { code: 'same_barcode', barcode: 'OLD-1' },
                { code: 'same_bottle' }
            ]);
        }
    });

    it('are to settle when neither twin has them', async () => {
        const answer = await check(
            undefined,
            true,
            file('Clos des Mouches,Joseph Drouhin,Beaune,Still,Red,75 cl,2016,')
        );

        expect(answer.results[1].errors).toEqual([
            { row: 1, problems: [{ code: 'several_wines', name: 'Clos des Mouches' }] }
        ]);
    });
});
