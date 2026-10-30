import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../test/wine';
import { GET } from './+server';

describe('GET /api/statistics', () => {
    it('sums the available bottles, and counts the others apart', async () => {
        const definitionId = await insertWineDefinition();
        await db
            .update(wineDefinitions)
            .set({ producer: 'Margaux SA' })
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
            winesByColor: [{ color: 'Red', count: 2 }],
            winesByCountry: [{ country: 'France', count: 2 }],
            winesByRegion: [{ region: 'Bordeaux', count: 2 }],
            winesByVintage: [
                { vintage: 2015, count: 1 },
                { vintage: 2018, count: 1 }
            ],
            winesByDecade: [{ decade: 2010, count: 2 }],
            topProducers: [{ producer: 'Margaux SA', count: 2 }],
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
});
