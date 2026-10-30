import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../test/event';
import { insertWineDefinition } from '../../../../test/wine';
import { DELETE, GET, PUT } from './+server';

const remove = (id: string) =>
    DELETE(
        fakeEvent<Parameters<typeof DELETE>[0]>({
            method: 'DELETE',
            path: `/api/definitions/${id}`,
            routeId: '/api/definitions/[id]',
            params: { id }
        })
    );

describe('DELETE /api/definitions/[id]', () => {
    it('answers 409 and keeps a wine that still has bottles', async () => {
        const timestamps = { createdAt: new Date(), updatedAt: new Date() };
        const definitionId = await insertWineDefinition();
        await db
            .insert(wineBottles)
            .values({ id: 'b1', definitionId, formatId: 'bottle', ...timestamps });

        const response = await remove(definitionId);

        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'in_use',
            details: { bottleCount: 1 }
        });
        expect(await db.select().from(wineDefinitions)).toHaveLength(1);
    });
});

describe('PUT /api/definitions/[id]', () => {
    const put = (id: string, body: unknown) =>
        PUT(
            fakeEvent<Parameters<typeof PUT>[0]>({
                method: 'PUT',
                path: `/api/definitions/${id}`,
                routeId: '/api/definitions/[id]',
                params: { id },
                body
            })
        );

    it('replaces the fields a client may set, and only them', async () => {
        const [wine] = await db.select().from(wineDefinitions);

        const response = await put(wine.id, {
            ...wine,
            name: 'Margaux (renamed)',
            id: 'other',
            createdAt: 0,
            targetQuantity: 6
        });

        expect(response.status).toBe(200);
        const [saved] = await db.select().from(wineDefinitions);
        expect(saved).toMatchObject({
            id: wine.id,
            name: 'Margaux (renamed)',
            targetQuantity: 6,
            createdAt: wine.createdAt
        });
    });

    it('answers 404 for a wine that does not exist', async () => {
        const [wine] = await db.select().from(wineDefinitions);

        expect((await put('none', wine)).status).toBe(404);
    });

    it('answers 422 for a rating out of 1 to 5, and keeps the wine as it was', async () => {
        const [wine] = await db.select().from(wineDefinitions);

        const response = await PUT(
            fakeEvent<Parameters<typeof PUT>[0]>({
                method: 'PUT',
                path: `/api/definitions/${wine.id}`,
                routeId: '/api/definitions/[id]',
                params: { id: wine.id },
                body: { ...wine, rating: 7 }
            })
        );

        expect(response.status).toBe(422);
        expect((await response.json()).error.details).toEqual([
            { path: 'rating', message: expect.any(String) }
        ]);
        expect(
            await db.select().from(wineDefinitions).where(eq(wineDefinitions.id, wine.id))
        ).toEqual([wine]);
    });
});

describe('GET /api/definitions/[id]', () => {
    const get = (id: string) =>
        GET(
            fakeEvent<Parameters<typeof GET>[0]>({
                path: `/api/definitions/${id}`,
                routeId: '/api/definitions/[id]',
                params: { id }
            })
        );

    it('answers the wine with the names of its references and its location', async () => {
        const [wine] = await db.select().from(wineDefinitions);

        const response = await get(wine.id);

        expect(response.status).toBe(200);
        const answer = await response.json();
        expect(answer).toMatchObject({
            id: wine.id,
            type: 'Still',
            color: 'Red',
            classification: null,
            grapeVarieties: [],
            appellation: {
                id: 'mgx',
                name: 'Margaux',
                region: { id: 'bdx', name: 'Bordeaux', country: { id: 'fr', name: 'France' } }
            }
        });
        // Only nested: the location is no longer repeated flat.
        expect(Object.keys(answer)).not.toContain('appellations');
        expect(Object.keys(answer)).not.toContain('regions');
        expect(Object.keys(answer)).not.toContain('countries');
    });

    it('answers 404 for a wine that does not exist', async () => {
        const response = await get('none');

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });
});
