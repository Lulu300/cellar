import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineColors, wineDefinitions } from '#lib/server/db/schema.js';
import { NEUTRAL_HEX } from '#lib/shared/wine-colors.js';
import { fakeEvent } from '../../../test/event';
import { insertBottles, insertProducer, insertWineDefinition } from '../../../test/wine';
import { GET } from './+server';

describe('GET /api/statistics', () => {
    let definitionId: string;
    beforeAll(async () => {
        definitionId = await insertWineDefinition();
    });
    beforeEach(() => db.delete(wineBottles).run());

    it('sums the available bottles, and counts the others apart', async () => {
        await db
            .update(wineDefinitions)
            .set({ producerId: await insertProducer('Margaux SA') })
            .where(eq(wineDefinitions.id, definitionId));
        await insertBottles(definitionId, [
            { availability: 'available', vintage: 2015, purchasePrice: 30, currentValue: 50 },
            { availability: 'available', vintage: 2018, purchasePrice: 20 },
            { availability: 'consumed', vintage: 2010, purchasePrice: 100 },
            { availability: 'out_of_cellar', vintage: 2012 }
        ]);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/statistics' })
        );

        expect(response.status).toBe(200);
        const statistics = await response.json();
        expect(statistics).toMatchObject({
            // The current value, else the purchase price, of each available bottle: 50 + 20.
            valueStats: {
                totalPurchaseValue: 50,
                totalCurrentValue: 50,
                totalHybridValue: 70,
                avgPurchasePrice: 25,
                avgCurrentValue: 50
            },
            winesByType: [{ type: 'Still', count: 2 }],
            winesByColor: [{ color: 'Red', hex: NEUTRAL_HEX, count: 2 }],
            winesByCountry: [{ country: 'France', count: 2 }],
            winesByRegion: [{ region: 'Bordeaux', count: 2 }],
            winesByVintage: [
                { vintage: 2015, count: 1 },
                { vintage: 2018, count: 1 }
            ],
            winesByDecade: [{ decade: 2010, count: 2 }],
            topProducers: [{ producerId: expect.any(String), producer: 'Margaux SA', count: 2 }],
            totalStats: {
                totalDefinitions: 1,
                totalBottles: 2,
                totalConsumed: 1,
                totalOutOfCellar: 1
            }
        });
        expect(statistics.bottlesByAvailability).toEqual(
            expect.arrayContaining([
                { availability: 'available', count: 2 },
                { availability: 'consumed', count: 1 },
                { availability: 'out_of_cellar', count: 1 }
            ])
        );
    });

    // The pie of the colours draws each in its colour value, in the order of their names.
    it('gives each colour its colour value, by name', async () => {
        // An id sorting first, so that an order by id would put White first.
        await db.insert(wineColors).values({ id: '0-white', color: 'White', hex: '#eeddaa' });
        await db.insert(wineDefinitions).values({
            id: 'blanc',
            name: 'Blanc',
            appellationId: 'mgx',
            typeId: 'still',
            colorId: '0-white'
        });
        await insertBottles(definitionId, [{ availability: 'available' }]);
        await insertBottles('blanc', [
            { availability: 'available' },
            { availability: 'available' }
        ]);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/statistics' })
        );

        expect((await response.json()).winesByColor).toEqual([
            { color: 'Red', hex: NEUTRAL_HEX, count: 1 },
            { color: 'White', hex: '#eeddaa', count: 2 }
        ]);
    });
});
