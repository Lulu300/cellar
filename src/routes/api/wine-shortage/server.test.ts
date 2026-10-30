import { describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineDefinitions } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../test/event';
import { insertBottles, insertWineDefinition } from '../../../test/wine';
import { GET } from './+server';

describe('GET /api/wine-shortage', () => {
    it('lists the wines with fewer available bottles than their target', async () => {
        await insertWineDefinition();
        const now = new Date();
        const timestamps = { createdAt: now, updatedAt: now };
        const wine = { appellationId: 'mgx', typeId: 'still', colorId: 'red', ...timestamps };
        await db.insert(wineDefinitions).values([
            { ...wine, id: 'short', name: 'Short', targetQuantity: 3 },
            { ...wine, id: 'stocked', name: 'Stocked', targetQuantity: 1 },
            { ...wine, id: 'untargeted', name: 'Untargeted' }
        ]);
        await insertBottles('short', [
            { availability: 'available', purchasePrice: 20 },
            { availability: 'consumed', purchasePrice: 40 }
        ]);
        await insertBottles('stocked', [{ availability: 'available' }]);

        const response = await GET(
            fakeEvent<Parameters<typeof GET>[0]>({ path: '/api/wine-shortage' })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([
            {
                id: 'short',
                name: 'Short',
                producer: null,
                targetQuantity: 3,
                imageId: null,
                appellation: 'Margaux',
                region: 'Bordeaux',
                country: 'France',
                type: 'Still',
                color: 'Red',
                classification: null,
                currentCount: 1,
                totalCount: 2,
                // The price of the consumed bottle does not count.
                minPrice: 20,
                maxPrice: 20,
                avgPrice: 20,
                shortage: 2,
                shortagePercentage: 67,
                fulfillmentPercentage: 33
            }
        ]);
    });
});
