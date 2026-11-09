import { beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineBottles } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { fakeEvent } from '../../../test/event';
import { failWrites } from '../../../test/failing-write';
import { insertWineDefinition } from '../../../test/wine';
import { formatBarcodeRange } from '#lib/shared/barcode.js';
import { GET, PATCH, POST } from './+server';

type Event = Parameters<typeof POST>[0];

const post = (body: unknown) =>
    POST(fakeEvent<Event>({ method: 'POST', path: '/api/bottles', routeId: '/api/bottles', body }));

const patch = (body: unknown) =>
    PATCH(
        fakeEvent<Event>({ method: 'PATCH', path: '/api/bottles', routeId: '/api/bottles', body })
    );

let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
});

describe('POST /api/bottles', () => {
    beforeAll(() => {
        setAppSetting('barcode_auto_generation', 'false');
    });

    it('creates the requested number of bottles', async () => {
        const response = await post({ definitionId, formatId: 'bottle', quantity: 2 });

        expect(response.status).toBe(201);
        const answer = await response.json();
        expect(Object.keys(answer)).toEqual(['bottles', 'count']);
        expect(answer.count).toBe(2);
        expect(answer.bottles).toHaveLength(2);
    });

    // Only the vintage: 0 is a year like any other for the optimum.
    it('stores a vintage of 0 as no vintage, and keeps an optimum of 0', async () => {
        const response = await post({ definitionId, formatId: 'bottle', vintage: 0, optimum: 0 });

        const [{ id }] = (await response.json()).bottles;
        const [stored] = await db.select().from(wineBottles).where(eq(wineBottles.id, id));
        expect(stored).toMatchObject({ vintage: null, optimum: 0 });
    });

    it('refuses with 409 a manual barcode that another bottle already has', async () => {
        await post({ definitionId, formatId: 'bottle', barcode: 'MY-CODE' });
        const before = await db.select().from(wineBottles);

        const response = await post({ definitionId, formatId: 'bottle', barcode: ' MY-CODE ' });

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('duplicate_barcode');
        expect(await db.select().from(wineBottles)).toHaveLength(before.length);
    });

    it('creates no bottle when one bottle cannot be inserted', async () => {
        const before = await db.select().from(wineBottles);
        failWrites(
            'INSERT',
            'wine_bottles',
            `(SELECT count(*) FROM wine_bottles) = ${before.length + 2}`
        );

        const response = await post({ definitionId, formatId: 'bottle', quantity: 4 });

        expect(response.status).toBe(500);
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    it.each([
        ['a status that is not one of the three', { availability: 'sold' }],
        ['a million bottles', { quantity: 1_000_000 }],
        ['a format given by name instead of id', { formatId: undefined, format: 'Bottle' }],
        ['a barcode that is neither text nor a number', { barcode: { value: 1 } }],
        ['notes of more than 5,000 characters', { notes: 'x'.repeat(5_001) }],
        // An emoji is two UTF-16 units, as the forms and the imports count it (API-12).
        ['notes of 2,500 emoji and a letter', { notes: '🍷'.repeat(2_500) + 'x' }],
        ['a negative purchase price', { purchasePrice: -5 }],
        ['a negative current value', { currentValue: -0.01 }]
    ])('answers 422 to %s, and creates nothing', async (_, fields) => {
        const before = await db.select().from(wineBottles);

        const response = await post({ definitionId, formatId: 'bottle', ...fields });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('invalid_body');
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    it('answers 422 to a drinking window that ends before it starts, and creates nothing', async () => {
        const before = db.select().from(wineBottles).all().length;

        const response = await post({
            definitionId,
            formatId: 'bottle',
            drinkFrom: '2027-03',
            drinkBefore: '2027-02'
        });

        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
            error: {
                code: 'window_ends_before_start',
                details: { bottles: [{ drinkFrom: '2027-03', drinkBefore: '2027-02' }] }
            }
        });
        expect(db.select().from(wineBottles).all()).toHaveLength(before);
    });

    it('answers 422 to a manual barcode for several bottles, and creates nothing', async () => {
        const before = await db.select().from(wineBottles);

        const response = await post({
            definitionId,
            formatId: 'bottle',
            barcode: 'TWICE',
            quantity: 2
        });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('barcode_for_one_bottle');
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    // FEAT-13: SQLite does not say which id is unknown; the answer does.
    it.each([
        ['a wine', 'definitionId', 'no-such-wine'],
        ['a format', 'formatId', 'no-such-format'],
        ['an origin', 'originId', 'no-such-origin'],
        ['a storage case', 'storageCaseId', 'no-such-case']
    ])('answers 409 for %s that does not exist, naming its field', async (_, field, id) => {
        const before = await db.select().from(wineBottles);

        const response = await post({ definitionId, formatId: 'bottle', [field]: id });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toEqual({
            code: 'missing_reference',
            message: `An entry it refers to does not exist (${field} ${id})`,
            details: [{ field, id }]
        });
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    it('names every unknown id of a request', async () => {
        const response = await post({
            definitionId,
            formatId: 'magnum-xl',
            originId: 'corner-shop',
            quantity: 2
        });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'missing_reference',
            message:
                'An entry it refers to does not exist (originId corner-shop, formatId magnum-xl)',
            details: [
                { field: 'originId', id: 'corner-shop' },
                { field: 'formatId', id: 'magnum-xl' }
            ]
        });
    });

    it('answers 409 once the prefix has no barcode number left', async () => {
        await post({ definitionId, formatId: 'bottle', barcode: 'CELLAR9999' });
        setAppSetting('barcode_prefix', 'CELLAR');
        setAppSetting('barcode_auto_generation', 'true');
        const before = await db.select().from(wineBottles);

        const response = await post({ definitionId, formatId: 'bottle' });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'barcode_range',
            message: expect.stringMatching(/numbers go from 1 to 9999/)
        });
        expect(await db.select().from(wineBottles)).toHaveLength(before.length);
    });

    it('answers 409 barcode_prefix_too_long to an old prefix of 7 characters or more', async () => {
        // A prefix saved before prefixes were validated.
        setAppSetting('barcode_prefix', 'OLDWINES');
        setAppSetting('barcode_auto_generation', 'true');
        const before = await db.select().from(wineBottles);

        const response = await post({ definitionId, formatId: 'bottle' });

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('barcode_prefix_too_long');
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    it('creates none of the bottles when the prefix runs out in the middle', async () => {
        setAppSetting('barcode_auto_generation', 'false');
        await post({ definitionId, formatId: 'bottle', barcode: 'LAST999998' });
        setAppSetting('barcode_prefix', 'LAST');
        setAppSetting('barcode_auto_generation', 'true');
        const before = await db.select().from(wineBottles);

        // LAST999999 is the last code of the prefix: there is none left for the second bottle.
        const response = await post({ definitionId, formatId: 'bottle', quantity: 3 });

        expect(response.status).toBe(409);
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    it('gives distinct barcodes to two creations sent at the same time', async () => {
        setAppSetting('barcode_prefix', 'PAR');
        setAppSetting('barcode_auto_generation', 'true');

        const responses = await Promise.all([
            post({ definitionId, formatId: 'bottle', quantity: 6 }),
            post({ definitionId, formatId: 'bottle', quantity: 6 })
        ]);

        expect(responses.map((response) => response.status)).toEqual([201, 201]);
        const created = await Promise.all(responses.map((response) => response.json()));
        const codes = created.flatMap(({ bottles }) =>
            bottles.map((bottle: { barcode: string }) => bottle.barcode)
        );
        expect(codes.toSorted()).toEqual(formatBarcodeRange('PAR', 1, 12));
    });
});

describe('PATCH /api/bottles', () => {
    let ids: string[];

    beforeAll(async () => {
        setAppSetting('barcode_auto_generation', 'false');
        const response = await post({ definitionId, formatId: 'bottle', quantity: 3 });
        ids = (await response.json()).bottles.map((bottle: { id: string }) => bottle.id);
    });

    const rowsOf = (ids: string[]) =>
        db.select().from(wineBottles).where(inArray(wineBottles.id, ids)).all();

    it('changes the bottles in one request, and answers them', async () => {
        const response = await patch({ ids, changes: { availability: 'out_of_cellar' } });

        expect(response.status).toBe(200);
        const { bottles } = await response.json();
        expect(bottles.map((bottle: { id: string }) => bottle.id)).toEqual(ids);
        expect(rowsOf(ids).map((row) => row.availability)).toEqual(Array(3).fill('out_of_cellar'));
    });

    it('sets « drink before » on several bottles, then removes it', async () => {
        const response = await patch({ ids, changes: { drinkBefore: '2027-03' } });

        expect(response.status).toBe(200);
        expect(rowsOf(ids).map((row) => row.drinkBefore)).toEqual(Array(3).fill('2027-03'));

        await patch({ ids, changes: { drinkBefore: null } });
        expect(rowsOf(ids).map((row) => row.drinkBefore)).toEqual(Array(3).fill(null));
    });

    it('sets a drinking window on several bottles, and answers it', async () => {
        const response = await patch({
            ids,
            changes: { drinkFrom: '2026-09', drinkBefore: '2027' }
        });

        expect(response.status).toBe(200);
        const { bottles } = await response.json();
        expect(bottles[0]).toMatchObject({ drinkFrom: '2026-09', drinkBefore: '2027' });
        await patch({ ids, changes: { drinkFrom: null, drinkBefore: null } });
        expect(rowsOf(ids).map((row) => row.drinkFrom)).toEqual(Array(3).fill(null));
    });

    // FEAT-19: refused in the service, against what each bottle has.
    it('answers 422 naming the bottles whose window would end before it starts, and changes none', async () => {
        await patch({ ids: [ids[0]], changes: { drinkFrom: '2028' } });

        const response = await patch({ ids, changes: { drinkBefore: '2027' } });

        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
            error: {
                code: 'window_ends_before_start',
                details: { bottles: [{ id: ids[0], drinkFrom: '2028', drinkBefore: '2027' }] }
            }
        });
        expect(rowsOf(ids).map((row) => row.drinkBefore)).toEqual(Array(3).fill(null));
        await patch({ ids: [ids[0]], changes: { drinkFrom: null } });
    });

    it('answers 422 to a month without a year, and changes none', async () => {
        const response = await patch({ ids, changes: { drinkBefore: '03' } });

        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
            error: {
                code: 'invalid_body',
                details: [{ path: 'changes.drinkBefore', message: expect.any(String) }]
            }
        });
        expect(rowsOf(ids).map((row) => row.drinkBefore)).toEqual(Array(3).fill(null));
    });

    // POST and PATCH count the same UTF-16 units, an emoji two (API-12).
    it('takes back the notes of 5,000 UTF-16 units with emoji that POST took', async () => {
        const notes = '🍷'.repeat(2_499) + 'ab';
        const created = await post({ definitionId, formatId: 'bottle', notes });
        expect(created.status).toBe(201);
        const [bottle] = (await created.json()).bottles;

        const response = await patch({ ids: [bottle.id], changes: { notes } });

        expect(response.status).toBe(200);
        expect(rowsOf([bottle.id])[0].notes).toBe(notes);
    });

    it('answers 404 naming the bottles that do not exist, and changes none', async () => {
        const before = rowsOf(ids);

        const response = await patch({ ids: [...ids, 'gone'], changes: { notes: 'Tasted' } });

        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'not_found',
            details: { ids: ['gone'] }
        });
        expect(rowsOf(ids)).toEqual(before);
    });

    it.each([
        ['no bottle', { ids: [], changes: { notes: 'x' } }],
        ['no changes', { ids: ['a'] }],
        ['a field that bottles do not have', { ids: ['a'], changes: { status: 'consumed' } }],
        [
            'a status that is not one of the three',
            { ids: ['a'], changes: { availability: 'sold' } }
        ],
        ['no wine', { ids: ['a'], changes: { definitionId: null } }],
        [
            'notes of more than 5,000 characters',
            { ids: ['a'], changes: { notes: 'x'.repeat(5_001) } }
        ],
        [
            'notes of 2,500 emoji and a letter',
            { ids: ['a'], changes: { notes: '🍷'.repeat(2_500) + 'x' } }
        ],
        [
            'an added note of 2,500 emoji and a letter',
            { ids: ['a'], changes: {}, addedNote: '🍷'.repeat(2_500) + 'x' }
        ],
        ['a negative purchase price', { ids: ['a'], changes: { purchasePrice: -5 } }],
        ['a negative current value', { ids: ['a'], changes: { currentValue: -0.01 } }]
    ])('answers 422 to %s', async (_, body) => {
        const response = await patch(body);

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('invalid_body');
    });

    it('answers 409 when a case has no room for the bottles, and changes none', async () => {
        const created = await (
            await post({ definitionId, formatId: 'bottle', quantity: 2 })
        ).json();
        const { cases } = createContainer({ name: 'Small', cases: ['1'], caseCapacities: [1] });
        const moved = created.bottles.map((bottle: { id: string }) => bottle.id);
        const before = rowsOf(moved);

        const response = await patch({ ids: moved, changes: { storageCaseId: cases[0].id } });

        expect(response.status).toBe(409);
        // FEAT-13: the case's id, for a client to look at what it holds.
        expect((await response.json()).error).toMatchObject({
            code: 'case_full',
            details: { caseId: cases[0].id, caseName: 'Small1', capacity: 1, bottles: 2 }
        });
        expect(rowsOf(moved)).toEqual(before);
    });

    it('answers 409 naming an unknown format, and changes none', async () => {
        const before = rowsOf(ids);

        const response = await patch({ ids, changes: { formatId: 'jeroboam-xl' } });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'missing_reference',
            details: [{ field: 'formatId', id: 'jeroboam-xl' }]
        });
        expect(rowsOf(ids)).toEqual(before);
    });

    it('answers 422 to one manual barcode for several bottles, and changes none', async () => {
        const before = rowsOf(ids);

        const response = await patch({ ids, changes: { barcode: 'TWICE' } });

        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('barcode_for_one_bottle');
        expect(rowsOf(ids)).toEqual(before);
    });

    describe('with a note to add', () => {
        /** A bottle with these notes, and one without any; returns their ids. */
        async function bottlesWithAndWithoutNotes(notes: string): Promise<string[]> {
            const created = await Promise.all([
                post({ definitionId, formatId: 'bottle', notes }),
                post({ definitionId, formatId: 'bottle' })
            ]);
            return Promise.all(
                created.map(async (response) => (await response.json()).bottles[0].id)
            );
        }

        const notesOf = (ids: string[]) => ids.map((id) => rowsOf([id])[0].notes);

        // A note typed when consuming used to replace the notes of every bottle consumed.
        it('adds it on a new line after the notes of each bottle, or alone', async () => {
            const bottles = await bottlesWithAndWithoutNotes('Gift from Marie');

            const response = await patch({
                ids: bottles,
                changes: { availability: 'consumed', consumedDate: '2026-10-18' },
                addedNote: 'Drunk with Paul'
            });

            expect(response.status).toBe(200);
            expect(notesOf(bottles)).toEqual([
                'Gift from Marie\nDrunk with Paul',
                'Drunk with Paul'
            ]);
            expect(rowsOf(bottles).map((row) => row.availability)).toEqual([
                'consumed',
                'consumed'
            ]);
        });

        it('adds it after the notes that the changes give', async () => {
            const bottles = await bottlesWithAndWithoutNotes('Gift from Marie');

            await patch({ ids: bottles, changes: { notes: 'Cellar door' }, addedNote: 'Tasted' });

            expect(notesOf(bottles)).toEqual(['Cellar door\nTasted', 'Cellar door\nTasted']);
        });

        it('keeps the notes as they are when the note is blank', async () => {
            const bottles = await bottlesWithAndWithoutNotes('Gift from Marie');

            const response = await patch({
                ids: bottles,
                changes: { availability: 'consumed' },
                addedNote: '  '
            });

            expect(response.status).toBe(200);
            expect(notesOf(bottles)).toEqual(['Gift from Marie', null]);
        });

        // Notes hold 5,000 characters at most (DATA-10): cutting would lose the end of the note.
        it('answers 422 naming the bottles whose notes it would make too long, and changes none', async () => {
            const bottles = await bottlesWithAndWithoutNotes('x'.repeat(4_990));
            const before = rowsOf(bottles);

            const response = await patch({
                ids: bottles,
                changes: { availability: 'consumed' },
                addedNote: 'Drunk with Paul'
            });

            expect(response.status).toBe(422);
            expect((await response.json()).error).toMatchObject({
                code: 'notes_too_long',
                details: { ids: [bottles[0]], bottles: 1, maximum: 5_000 }
            });
            expect(rowsOf(bottles)).toEqual(before);
        });

        it('adds a note that fills the notes up to 5,000 characters', async () => {
            const bottles = await bottlesWithAndWithoutNotes('x'.repeat(4_984));

            const response = await patch({
                ids: bottles,
                changes: {},
                addedNote: 'Drunk with Paul'
            });

            expect(response.status).toBe(200);
            expect(notesOf(bottles).map((notes) => notes?.length)).toEqual([5_000, 15]);
        });
    });
});

describe('GET /api/bottles', () => {
    it('lists every bottle with its wine, format, case and origin', async () => {
        setAppSetting('barcode_auto_generation', 'false');
        const created = await (
            await post({ definitionId, formatId: 'bottle', vintage: 2016, notes: 'Listed' })
        ).json();

        const response = await GET(fakeEvent<Event>({ path: '/api/bottles' }));

        expect(response.status).toBe(200);
        const bottles = await response.json();
        expect(bottles).toHaveLength((await db.select().from(wineBottles)).length);
        expect(
            bottles.find((bottle: { id: string }) => bottle.id === created.bottles[0].id)
        ).toMatchObject({
            definitionId,
            vintage: 2016,
            notes: 'Listed',
            availability: 'available',
            format: 'Bottle',
            storageCase: null,
            origin: null,
            definition: { id: definitionId, name: 'Château Margaux', type: 'Still', color: 'Red' }
        });
    });
});
