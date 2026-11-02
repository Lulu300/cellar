import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineBottles } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../../test/wine';
import { DELETE, PATCH } from './+server';

const patch = (id: string, body: unknown) =>
    PATCH(
        fakeEvent<Parameters<typeof PATCH>[0]>({
            method: 'PATCH',
            path: `/api/bottles/${id}`,
            routeId: '/api/bottles/[id]',
            params: { id },
            body
        })
    );

let definitionId: string;

beforeAll(async () => {
    definitionId = await insertWineDefinition();
    await insertBottles(
        definitionId,
        ['first', 'second'].map((id) => ({ id, barcode: id.toUpperCase() }))
    );
});

async function barcodeOf(id: string) {
    const [bottle] = await db.select().from(wineBottles).where(eq(wineBottles.id, id));
    return bottle.barcode;
}

describe('PATCH /api/bottles/[id]', () => {
    const rowOf = (id: string) =>
        db.select().from(wineBottles).where(eq(wineBottles.id, id)).get()!;

    it('changes the fields given and keeps the others, the status included', async () => {
        await db
            .update(wineBottles)
            .set({ availability: 'out_of_cellar', vintage: 2010, barcode: 'SECOND' })
            .where(eq(wineBottles.id, 'second'));
        const before = rowOf('second');

        const response = await patch('second', { notes: 'For Sunday' });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ notes: 'For Sunday', format: 'Bottle' });
        expect(rowOf('second')).toEqual({
            ...before,
            notes: 'For Sunday',
            updatedAt: expect.any(Date)
        });
    });

    it('refuses the barcode of another bottle', async () => {
        await db.update(wineBottles).set({ barcode: 'FIRST' }).where(eq(wineBottles.id, 'first'));

        const response = await patch('second', { barcode: ' FIRST ' });

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('duplicate_barcode');
        expect(await barcodeOf('second')).toBe('SECOND');
    });

    it('keeps the barcode of the bottle itself', async () => {
        const response = await patch('first', { barcode: 'FIRST' });

        expect(response.status).toBe(200);
        expect(await barcodeOf('first')).toBe('FIRST');
    });

    it.each([
        ['a field that bottles do not have', { definition: { id: 'margaux' } }],
        ['no format', { formatId: null }],
        ['a status that is not one of the three', { availability: 'sold' }]
    ])('answers 422 to %s, and keeps the bottle', async (_, body) => {
        const before = rowOf('second');

        const response = await patch('second', body);

        expect(response.status).toBe(422);
        expect(rowOf('second')).toEqual(before);
    });

    it('answers 409 for a storage case that does not exist, naming it, and keeps the bottle', async () => {
        const response = await patch('first', { storageCaseId: 'no-such-case' });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'missing_reference',
            details: [{ field: 'storageCaseId', id: 'no-such-case' }]
        });
        expect(rowOf('first').storageCaseId).toBeNull();
    });

    // Stored as such, a blank barcode would be the same barcode on several bottles.
    it('removes the barcode of each bottle given a blank one', async () => {
        expect((await patch('first', { barcode: '' })).status).toBe(200);
        expect((await patch('second', { barcode: '  ' })).status).toBe(200);

        expect(await barcodeOf('first')).toBeNull();
        expect(await barcodeOf('second')).toBeNull();
    });

    it('answers 404 for a bottle that does not exist', async () => {
        const response = await patch('none', { notes: 'x' });

        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'not_found',
            details: { ids: ['none'] }
        });
    });
});

describe('DELETE /api/bottles/[id]', () => {
    const remove = (id: string) =>
        DELETE(
            fakeEvent<Parameters<typeof DELETE>[0]>({
                method: 'DELETE',
                path: `/api/bottles/${id}`,
                routeId: '/api/bottles/[id]',
                params: { id }
            })
        );

    it('deletes the bottle and answers 204', async () => {
        await insertBottles(definitionId, [{ id: 'third' }]);

        const response = await remove('third');

        expect(response.status).toBe(204);
        expect(await db.select().from(wineBottles).where(eq(wineBottles.id, 'third'))).toEqual([]);
    });

    it('answers 404 for a bottle that does not exist', async () => {
        const response = await remove('none');

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });
});
