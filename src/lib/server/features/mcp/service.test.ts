import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineDefinitions
} from '#lib/server/db/schema.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { insertBottles, insertWineDefinition } from '../../../../test/wine';
import {
    bottlesByBarcode,
    freeSpace,
    searchWines,
    wineShortages,
    wineWithBottles
} from './service';

let margaux: string;
const barolo = 'barolo';

beforeAll(async () => {
    margaux = await insertWineDefinition();
    const timestamps = { createdAt: new Date(), updatedAt: new Date() };
    db.insert(countries)
        .values({ id: 'it', name: 'Italie', ...timestamps })
        .run();
    db.insert(regions)
        .values({ id: 'pie', name: 'Piémont', countryId: 'it', ...timestamps })
        .run();
    db.insert(appellations)
        .values({ id: 'bar', name: 'Barolo', regionId: 'pie', ...timestamps })
        .run();
    db.insert(wineDefinitions)
        .values({
            id: barolo,
            name: 'Cannubi',
            producer: 'Élevage Côté',
            appellationId: 'bar',
            typeId: 'still',
            colorId: 'red',
            grapeVarieties: ['Nebbiolo'],
            targetQuantity: 4,
            ...timestamps
        })
        .run();
});

beforeEach(() => {
    db.delete(wineBottles).run();
    db.delete(storageCases).run();
    db.delete(storageContainers).run();
});

const search = (query?: string, fields: { inCellarOnly?: boolean; limit?: number } = {}) =>
    searchWines({ query, inCellarOnly: false, limit: 50, ...fields });

const namesOf = ({ wines }: { wines: { name: string }[] }) => wines.map((wine) => wine.name);

describe('searchWines', () => {
    it('finds the wines that hold every word, in any field, capitals and accents aside', () => {
        expect(namesOf(search('piemont nebbiolo'))).toEqual(['Cannubi']);
        expect(namesOf(search('COTE'))).toEqual(['Cannubi']);
        expect(namesOf(search('france red'))).toEqual(['Château Margaux']);
        expect(namesOf(search('margaux nebbiolo'))).toEqual([]);
        expect(namesOf(search())).toEqual(['Cannubi', 'Château Margaux']);
    });

    it('counts the bottles in the cellar and out of it, and gives the vintages in the cellar', async () => {
        await insertBottles(margaux, [
            { availability: 'available', vintage: 2015 },
            { availability: 'available', vintage: 2010 },
            { availability: 'available', vintage: null },
            { availability: 'available', vintage: 2015 },
            { availability: 'out_of_cellar', vintage: 2005 },
            { availability: 'consumed', vintage: 2000 }
        ]);

        expect(search('margaux').wines[0]).toMatchObject({
            id: margaux,
            appellation: 'Margaux',
            region: 'Bordeaux',
            country: 'France',
            inCellar: 4,
            outOfCellar: 1,
            vintages: [2010, 2015, null]
        });
    });

    it('keeps only the wines with a bottle in the cellar when asked', async () => {
        await insertBottles(barolo, [{ availability: 'out_of_cellar' }]);
        await insertBottles(margaux, [{ availability: 'available' }]);

        expect(namesOf(search(undefined, { inCellarOnly: true }))).toEqual(['Château Margaux']);
    });

    it('returns at most `limit` wines, and counts them all', () => {
        expect(search(undefined, { limit: 1 })).toMatchObject({
            total: 2,
            wines: [{ name: 'Cannubi' }]
        });
    });
});

describe('wineWithBottles', () => {
    it('gives the bottles still owned, with their place, apart from those drunk', async () => {
        const { cases } = createContainer({
            name: 'Column B',
            cases: ['1'],
            caseCapacities: [6]
        });
        await insertBottles(margaux, [
            { id: 'here', availability: 'available', storageCaseId: cases[0].id, vintage: 2015 },
            { id: 'out', availability: 'out_of_cellar', notes: 'Lent' },
            {
                id: 'drunk',
                availability: 'consumed',
                consumedDate: new Date('2026-09-12T20:00:00Z'),
                notes: 'With roast chicken'
            }
        ]);

        const wine = wineWithBottles(margaux);

        expect(wine).toMatchObject({ id: margaux, name: 'Château Margaux', color: 'Red' });
        expect(wine.bottles.map((bottle) => [bottle.id, bottle.location])).toEqual([
            // As the storage page names it.
            ['here', { container: 'B', case: 'Column B1' }],
            ['out', null]
        ]);
        expect(wine.consumed).toEqual([
            expect.objectContaining({
                id: 'drunk',
                consumedDate: '2026-09-12',
                notes: 'With roast chicken'
            })
        ]);
    });

    it('refuses an unknown wine', () => {
        expect(() => wineWithBottles('nothing')).toThrow(NotFoundError);
    });
});

describe('bottlesByBarcode', () => {
    it('finds the code as given, then in other capitals, then the codes that end with it', async () => {
        await insertBottles(margaux, [
            { id: 'upper', barcode: 'CV00000042', availability: 'consumed' },
            { id: 'lower', barcode: 'cv00000042' },
            { id: 'other', barcode: 'XX00000142' },
            { id: 'none', barcode: null }
        ]);
        const idsOf = (code: string) => bottlesByBarcode(code).map((bottle) => bottle.id);

        expect(idsOf('CV00000042')).toEqual(['upper']);
        expect(idsOf('Cv00000042')).toEqual(['upper', 'lower']);
        expect(idsOf('42').sort()).toEqual(['lower', 'other', 'upper']);
        expect(idsOf('nothing')).toEqual([]);
        expect(bottlesByBarcode('CV00000042')[0]).toMatchObject({
            availability: 'consumed',
            wine: { id: margaux, name: 'Château Margaux' }
        });
    });
});

describe('wineShortages', () => {
    it('gives the wines below their target with how many bottles they miss', async () => {
        await insertBottles(barolo, [{ availability: 'available' }, { availability: 'consumed' }]);

        expect(await wineShortages()).toEqual([
            expect.objectContaining({ id: barolo, targetQuantity: 4, inCellar: 1, missing: 3 })
        ]);
    });
});

describe('freeSpace', () => {
    it('gives the room left in each case, a full one counting none, with the totals', async () => {
        const { cases } = createContainer({
            name: 'Column A',
            cases: ['1', '2'],
            caseCapacities: [2, 6]
        });
        // Three bottles in a case of two, as an import may leave it: no room, and none taken from
        // the other case.
        await insertBottles(margaux, [
            { storageCaseId: cases[0].id, availability: 'available' },
            { storageCaseId: cases[0].id, availability: 'available' },
            { storageCaseId: cases[0].id, availability: 'available' },
            { storageCaseId: cases[1].id, availability: 'available' },
            { storageCaseId: cases[1].id, availability: 'out_of_cellar' }
        ]);

        expect(freeSpace()).toEqual({
            capacity: 8,
            bottles: 4,
            free: 5,
            containers: [
                {
                    name: 'A',
                    capacity: 8,
                    bottles: 4,
                    free: 5,
                    cases: [
                        { name: 'Column A1', capacity: 2, bottles: 3, free: 0 },
                        { name: 'Column A2', capacity: 6, bottles: 1, free: 5 }
                    ]
                }
            ]
        });
    });
});
