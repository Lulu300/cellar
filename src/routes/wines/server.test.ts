import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { setAppSetting } from '#lib/server/features/settings/repository.js';
import { fakeEvent } from '../../test/event';
import { insertWineDefinition } from '../../test/wine';
import { actions } from './+page.server';

type ActionName = keyof typeof actions;

/** Posts a form to an action of /wines, as the dialogs do with `use:enhance`. */
function post(action: ActionName, fields: Record<string, string | string[]>) {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) {
        for (const item of [value].flat()) form.append(name, item);
    }
    const event = fakeEvent<Parameters<(typeof actions)[ActionName]>[0]>({
        method: 'POST',
        path: `/wines?/${action}`,
        routeId: '/wines',
        body: form
    });
    return actions[action](event);
}

/** The error body of a failed action, with its status. */
function refusal(result: unknown) {
    const { status, data } = result as { status: number; data: { error: { code: string } } };
    return { status, ...data.error };
}

const wine = { name: 'Pavillon Rouge', appellationId: 'mgx', typeId: 'still', colorId: 'red' };
let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
    setAppSetting('barcode_auto_generation', 'false');
});

describe('the wine form actions', () => {
    it('create a wine from the form, its empty fields as null and its numbers read', async () => {
        const result = await post('createWine', {
            ...wine,
            producer: '',
            classificationId: '',
            rating: '4.5',
            targetQuantity: '',
            grapeVarieties: ['Merlot', 'Cabernet Sauvignon']
        });

        expect(result).toMatchObject({
            definition: {
                ...wine,
                producer: null,
                classificationId: null,
                rating: 4.5,
                targetQuantity: null,
                grapeVarieties: ['Merlot', 'Cabernet Sauvignon']
            }
        });
    });

    it('refuse a form that breaks the schema of the API with 422, naming each field', async () => {
        const before = await db.select().from(wineDefinitions);

        const result = await post('createWine', { ...wine, name: ' ', rating: '7' });

        expect(refusal(result)).toMatchObject({
            status: 422,
            code: 'invalid_body',
            details: [
                { path: 'name', message: expect.any(String) },
                { path: 'rating', message: expect.any(String) }
            ]
        });
        expect(await db.select().from(wineDefinitions)).toEqual(before);
    });

    it('update the wine whose id the form gives, and answer 404 for none', async () => {
        const updated = await post('updateWine', { ...wine, id: definitionId, name: 'Margaux' });
        expect(updated).toMatchObject({ definition: { id: definitionId, name: 'Margaux' } });

        expect(refusal(await post('updateWine', { ...wine, id: 'no-such-wine' }))).toMatchObject({
            status: 404,
            code: 'not_found'
        });
    });
});

describe('the bottle form actions', () => {
    const bottle = () => ({ definitionId, formatId: 'bottle' });

    it('create as many bottles as the form asks', async () => {
        const result = await post('createBottles', { ...bottle(), quantity: '3', vintage: '' });

        expect(result).toMatchObject({ bottles: [{ vintage: null }, {}, {}] });
    });

    it('change only the fields that the edit form sends', async () => {
        const [created] = (
            (await post('createBottles', {
                ...bottle(),
                vintage: '2015',
                notes: 'Kept'
            })) as { bottles: { id: string }[] }
        ).bottles;

        await post('updateBottle', { id: created.id, vintage: '2016' });

        const [stored] = await db.select().from(wineBottles).where(eq(wineBottles.id, created.id));
        expect(stored).toMatchObject({ vintage: 2016, notes: 'Kept', formatId: 'bottle' });
    });

    // A browser sends each line break of a textarea as CRLF, which the field counts as one
    // character: a note as long as the field allows must not be refused for its line breaks.
    it('read the line breaks of a note as the field counts them, one character each', async () => {
        // Three lines of 1,666 characters and two line breaks: 5,000 characters.
        const typed = ['a', 'b', 'c'].map((letter) => letter.repeat(1_666)).join('\n');

        const result = await post('createBottles', {
            ...bottle(),
            notes: typed.replaceAll('\n', '\r\n')
        });

        const [{ id }] = (result as { bottles: { id: string }[] }).bottles;
        const [stored] = await db.select().from(wineBottles).where(eq(wineBottles.id, id));
        expect(stored.notes).toBe(typed);
    });

    it('store a vintage of 0 as no vintage, on creation and on edit', async () => {
        const [created] = (
            (await post('createBottles', { ...bottle(), vintage: '0' })) as {
                bottles: { id: string }[];
            }
        ).bottles;
        const vintage = async () =>
            (await db.select().from(wineBottles).where(eq(wineBottles.id, created.id)))[0].vintage;
        expect(await vintage()).toBeNull();

        await post('updateBottle', { id: created.id, vintage: '2015' });
        await post('updateBottle', { id: created.id, vintage: '0' });

        expect(await vintage()).toBeNull();
    });

    it('refuse a negative price or value with 422, naming the field', async () => {
        const [{ id }] = ((await post('createBottles', bottle())) as { bottles: { id: string }[] })
            .bottles;
        const before = await db.select().from(wineBottles);

        const created = await post('createBottles', { ...bottle(), purchasePrice: '-5' });
        const updated = await post('updateBottle', { id, currentValue: '-5' });

        expect(refusal(created)).toMatchObject({
            status: 422,
            details: [{ path: 'purchasePrice' }]
        });
        expect(refusal(updated)).toMatchObject({
            status: 422,
            details: [{ path: 'currentValue' }]
        });
        expect(await db.select().from(wineBottles)).toEqual(before);
    });

    it('refuse a barcode that another bottle has with 409, for the barcode field', async () => {
        await post('createBottles', { ...bottle(), barcode: 'TAKEN00001' });

        expect(
            refusal(await post('createBottles', { ...bottle(), barcode: 'TAKEN00001' }))
        ).toMatchObject({ status: 409, code: 'duplicate_barcode' });
    });

    // Found during BUG-01: the dialog showed a generic message for it.
    it('say with 409 barcode_range that the prefix has no number left', async () => {
        await post('createBottles', { ...bottle(), barcode: 'FULL999999' });
        setAppSetting('barcode_prefix', 'FULL');
        setAppSetting('barcode_auto_generation', 'true');
        try {
            expect(refusal(await post('createBottles', bottle()))).toMatchObject({
                status: 409,
                code: 'barcode_range'
            });
        } finally {
            setAppSetting('barcode_auto_generation', 'false');
        }
    });
});
