import { ne } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    regions,
    wineBottles,
    wineDefinitions,
    type NewWineBottle
} from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { insertBottles, insertProducer, insertWineDefinition } from '../../../../test/wine';
import { getStatistics, getWineShortages } from './service';

const { AVAILABLE, OUT_OF_CELLAR, CONSUMED } = BottleAvailability;
const now = new Date();
const timestamps = { createdAt: now, updatedAt: now };

let margaux: string;

beforeAll(async () => {
    // France, Bordeaux and Margaux, then a Bourgogne in France and another in Switzerland
    margaux = await insertWineDefinition();
    await db.insert(countries).values({ id: 'ch', name: 'Switzerland', ...timestamps });
    await db.insert(regions).values([
        { id: 'bourgogne-fr', name: 'Bourgogne', countryId: 'fr', ...timestamps },
        { id: 'bourgogne-ch', name: 'Bourgogne', countryId: 'ch', ...timestamps }
    ]);
    await db.insert(appellations).values([
        { id: 'beaune', name: 'Beaune', regionId: 'bourgogne-fr', ...timestamps },
        { id: 'vaud', name: 'Vaud', regionId: 'bourgogne-ch', ...timestamps }
    ]);
});

beforeEach(async () => {
    await db.delete(wineBottles);
    await db.delete(wineDefinitions).where(ne(wineDefinitions.id, margaux));
});

/** Inserts a wine of Margaux with `fields` set; returns its id. */
async function addWine(id: string, fields: Partial<typeof wineDefinitions.$inferInsert> = {}) {
    await db.insert(wineDefinitions).values({
        id,
        name: id,
        appellationId: 'mgx',
        typeId: 'still',
        colorId: 'red',
        ...timestamps,
        ...fields
    });
    return id;
}

/** Inserts `count` bottles of `definitionId`, each with `fields`. */
function addBottles(definitionId: string, count: number, fields: Partial<NewWineBottle> = {}) {
    return insertBottles(
        definitionId,
        Array.from({ length: count }, () => ({ ...fields }))
    );
}

describe('getWineShortages', () => {
    it('counts only the available bottles against the target', async () => {
        const wine = await addWine('short', { targetQuantity: 3 });
        await addBottles(wine, 1, { availability: AVAILABLE });
        await addBottles(wine, 1, { availability: OUT_OF_CELLAR });
        await addBottles(wine, 1, { availability: CONSUMED });

        expect(await getWineShortages()).toEqual([
            expect.objectContaining({
                id: 'short',
                currentCount: 1,
                totalCount: 3,
                shortage: 2,
                shortagePercentage: 67,
                fulfillmentPercentage: 33
            })
        ]);
    });

    it('lists a wine without bottles with its whole target, and never one without a target', async () => {
        await addWine('empty', { targetQuantity: 2 });
        await addWine('no target', { targetQuantity: null });
        await addWine('zero target', { targetQuantity: 0 });
        await addBottles(await addWine('enough', { targetQuantity: 1 }), 1);

        expect(await getWineShortages()).toEqual([
            expect.objectContaining({
                id: 'empty',
                currentCount: 0,
                shortage: 2,
                shortagePercentage: 100,
                fulfillmentPercentage: 0
            })
        ]);
    });

    it('puts the largest shortage first, then sorts by name', async () => {
        // The ids go the other way round from the names.
        await addWine('a', { name: 'Zeta', targetQuantity: 2 });
        await addWine('b', { name: 'alpha', targetQuantity: 2 });
        await addWine('c', { name: 'Échezeaux', targetQuantity: 5 });

        const names = (await getWineShortages()).map((wine) => wine.name);

        expect(names).toEqual(['Échezeaux', 'alpha', 'Zeta']);
    });
});

describe('getStatistics', () => {
    it('counts only the available bottles, except by status', async () => {
        await addBottles(margaux, 2, { availability: AVAILABLE, vintage: 2015 });
        await addBottles(margaux, 1, { availability: OUT_OF_CELLAR, vintage: 2015 });
        await addBottles(margaux, 1, { availability: CONSUMED, vintage: 2015 });

        const stats = await getStatistics();

        expect(stats.winesByType).toEqual([{ type: 'Still', count: 2 }]);
        expect(stats.winesByCountry).toEqual([{ country: 'France', count: 2 }]);
        expect(stats.winesByVintage).toEqual([{ vintage: 2015, count: 2 }]);
        expect(stats.bottlesByAvailability).toEqual(
            expect.arrayContaining([
                { availability: AVAILABLE, count: 2 },
                { availability: OUT_OF_CELLAR, count: 1 },
                { availability: CONSUMED, count: 1 }
            ])
        );
        expect(stats.totalStats).toEqual({
            totalDefinitions: 1,
            totalBottles: 2,
            totalConsumed: 1,
            totalOutOfCellar: 1
        });
    });

    it('leaves the bottles without a vintage out of the vintages and decades', async () => {
        await addBottles(margaux, 1, { vintage: null });
        await addBottles(margaux, 2, { vintage: 2012 });

        const stats = await getStatistics();

        expect(stats.winesByVintage).toEqual([{ vintage: 2012, count: 2 }]);
        expect(stats.winesByDecade).toEqual([{ decade: 2010, count: 2 }]);
    });

    it('gives no average price when no bottle has one', async () => {
        await addBottles(margaux, 2, { purchasePrice: null, currentValue: null });

        const { valueStats } = await getStatistics();

        expect(valueStats).toMatchObject({
            totalPurchaseValue: 0,
            avgPurchasePrice: null,
            avgCurrentValue: null
        });
    });

    it('keeps apart two regions of the same name in two countries', async () => {
        await addBottles(await addWine('beaune', { appellationId: 'beaune' }), 3);
        await addBottles(await addWine('vaud', { appellationId: 'vaud' }), 1);

        const { winesByRegion } = await getStatistics();

        expect(winesByRegion).toEqual([
            { id: 'bourgogne-fr', region: 'Bourgogne', country: 'France', count: 3 },
            { id: 'bourgogne-ch', region: 'Bourgogne', country: 'Switzerland', count: 1 }
        ]);
    });

    it('takes the 10 largest producers after leaving out the wines without one', async () => {
        // The wines without a producer have the most bottles.
        await addBottles(margaux, 20);
        for (let i = 1; i <= 11; i++) {
            const producerId = await insertProducer(`Producer ${i}`);
            await addBottles(await addWine(`wine ${i}`, { producerId }), i);
        }

        const { topProducers } = await getStatistics();

        expect(topProducers.map((row) => row.producer)).toEqual(
            Array.from({ length: 10 }, (_, i) => `Producer ${11 - i}`)
        );
    });
});
