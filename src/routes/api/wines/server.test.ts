import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../test/wine';
import { GET } from './+server';

const timestamps = { createdAt: new Date(), updatedAt: new Date() };

beforeAll(async () => {
    const definitionId = await insertWineDefinition();
    await db.insert(wineDefinitions).values({
        id: 'pavie',
        name: 'Château Pavie',
        appellationId: 'mgx',
        typeId: 'still',
        colorId: 'red',
        ...timestamps
    });
    await insertBottles(definitionId, [
        { id: 'margaux-2015', vintage: 2015 },
        { id: 'margaux-2018', vintage: 2018, availability: 'consumed' }
    ]);
});

describe('GET /api/wines', () => {
    it('lists each wine once, with its location and its bottles, consumed ones included', async () => {
        const response = await GET(fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/wines' }));

        expect(response.status).toBe(200);
        const wines = await response.json();
        const margaux = wines.find(
            (wine: { definition: { id: string } }) => wine.definition.id === 'margaux'
        );
        expect(wines).toHaveLength(2);
        expect(margaux.definition).toMatchObject({
            name: 'Château Margaux',
            type: 'Still',
            color: 'Red',
            appellationName: 'Margaux',
            region: 'Bordeaux',
            country: 'France'
        });
        expect(
            margaux.bottles.map((bottle: { id: string; availability: string }) => [
                bottle.id,
                bottle.availability
            ])
        ).toEqual(
            expect.arrayContaining([
                ['margaux-2015', 'available'],
                ['margaux-2018', 'consumed']
            ])
        );
        expect(margaux.bottles).toHaveLength(2);
    });

    it('lists a wine without bottles with an empty list of bottles', async () => {
        const response = await GET(fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/wines' }));

        const pavie = (await response.json()).find(
            (wine: { definition: { id: string } }) => wine.definition.id === 'pavie'
        );
        expect(pavie).toEqual({
            definition: expect.objectContaining({ name: 'Château Pavie' }),
            bottles: []
        });
    });
});
