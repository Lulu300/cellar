import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
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
import { listBottlesWithDefinitions } from '#lib/server/features/bottles/service.js';
import { getDefinitionDetails } from '#lib/server/features/catalog/service.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { insertBottles, insertWineDefinition } from '../../../../test/wine';
import {
    addBottles,
    addWine,
    bottlesByBarcode,
    changeBottleNotes,
    choices,
    freeSpace,
    markDrunk,
    moveBottles,
    rateWine,
    searchAppellations,
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
                        { id: cases[0].id, name: 'Column A1', capacity: 2, bottles: 3, free: 0 },
                        { id: cases[1].id, name: 'Column A2', capacity: 6, bottles: 1, free: 5 }
                    ]
                }
            ]
        });
    });
});

describe('choices', () => {
    it('gives the id and name of each row of the lists that the write tools take ids from', () => {
        expect(choices()).toEqual({
            formats: [{ id: 'bottle', name: 'Bottle' }],
            colors: [{ id: 'red', name: 'Red' }],
            types: [{ id: 'still', name: 'Still' }],
            classifications: [],
            origins: []
        });
    });
});

describe('searchAppellations', () => {
    it('finds the appellations whose name, region and country hold every word', () => {
        expect(searchAppellations('piemont')).toEqual({
            total: 1,
            appellations: [{ id: 'bar', name: 'Barolo', region: 'Piémont', country: 'Italie' }]
        });
        expect(searchAppellations('FRANCE margaux').appellations.map(({ id }) => id)).toEqual([
            'mgx'
        ]);
        expect(searchAppellations('margaux italie')).toEqual({ total: 0, appellations: [] });
    });

    it('returns at most 50 appellations, and counts them all', () => {
        const timestamps = { createdAt: new Date(), updatedAt: new Date() };
        db.insert(appellations)
            .values(
                Array.from({ length: 60 }, (_, i) => ({
                    id: `lot-${i}`,
                    name: `Lot ${i}`,
                    regionId: 'bdx',
                    ...timestamps
                }))
            )
            .run();

        const { total, appellations: found } = searchAppellations('lot');
        expect(total).toBe(60);
        expect(found).toHaveLength(50);
        db.delete(appellations).where(like(appellations.id, 'lot-%')).run();
    });
});

describe('addWine', () => {
    it('creates the wine and answers it with its appellation, region and country', () => {
        const wine = addWine({
            name: 'Barbaresco',
            producer: null,
            appellationId: 'bar',
            typeId: 'still',
            colorId: 'red',
            classificationId: null,
            rating: 4.5,
            website: null,
            description: null,
            imageId: null,
            grapeVarieties: ['Nebbiolo'],
            targetQuantity: null
        });

        expect(wine).toMatchObject({
            name: 'Barbaresco',
            appellation: 'Barolo',
            region: 'Piémont',
            country: 'Italie',
            rating: 4.5,
            grapes: ['Nebbiolo'],
            bottles: [],
            consumed: []
        });
        db.delete(wineDefinitions).where(eq(wineDefinitions.id, wine.id)).run();
    });
});

const purchase = {
    wineId: 'margaux',
    quantity: 1,
    formatId: 'bottle',
    originId: null,
    vintage: 2018,
    optimum: null,
    purchasePrice: 40,
    purchaseDate: null,
    caseId: null,
    barcode: null,
    notes: null
};

describe('addBottles', () => {
    it('adds the bottles in the cellar, each with its own id', () => {
        const { cases } = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [6] });

        const added = addBottles({ ...purchase, quantity: 2, caseId: cases[0].id });

        expect(added).toEqual([
            expect.objectContaining({
                wineId: margaux,
                availability: 'available',
                vintage: 2018,
                format: 'Bottle',
                caseId: cases[0].id
            }),
            expect.objectContaining({ caseId: cases[0].id })
        ]);
        expect(new Set(added.map((bottle) => bottle.id)).size).toBe(2);
    });

    it('adds none when the case has no room for them all', () => {
        const { cases } = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [1] });

        expect(() => addBottles({ ...purchase, quantity: 2, caseId: cases[0].id })).toThrow(
            expect.objectContaining({ code: 'case_full' })
        );
        expect(listBottlesWithDefinitions(margaux)).toEqual([]);
    });
});

describe('markDrunk', () => {
    it('marks the bottles drunk on the day given, out of their case, the note after their notes', async () => {
        const { cases } = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [6] });
        await insertBottles(margaux, [
            { id: 'a', storageCaseId: cases[0].id, notes: 'Gift from Anna' },
            { id: 'b', storageCaseId: cases[0].id }
        ]);

        const drunk = markDrunk(['a', 'b'], new Date('2026-10-30'), 'With roast chicken');

        expect(drunk).toEqual([
            expect.objectContaining({
                id: 'a',
                availability: 'consumed',
                caseId: null,
                consumedDate: '2026-10-30',
                notes: 'Gift from Anna\nWith roast chicken'
            }),
            expect.objectContaining({ id: 'b', notes: 'With roast chicken' })
        ]);
    });

    it("takes today on the server's calendar when no day is given", async () => {
        vi.stubEnv('TZ', 'Europe/Paris');
        vi.useFakeTimers({ toFake: ['Date'] });
        // Half past midnight in Paris, still the day before in UTC.
        vi.setSystemTime(new Date('2026-10-30T23:30:00Z'));
        await insertBottles(margaux, [{ id: 'a' }]);

        try {
            expect(markDrunk(['a'], null, null)).toEqual([
                expect.objectContaining({ consumedDate: '2026-10-31', notes: null })
            ]);
        } finally {
            vi.useRealTimers();
            vi.unstubAllEnvs();
        }
    });

    it('changes none of the bottles when one does not exist', async () => {
        await insertBottles(margaux, [{ id: 'a' }]);

        expect(() => markDrunk(['a', 'gone'], null, null)).toThrow(NotFoundError);
        expect(listBottlesWithDefinitions(margaux)[0].availability).toBe('available');
    });
});

describe('moveBottles', () => {
    it('puts the bottles in the case, or none when it has no room for them all', async () => {
        const { cases } = createContainer({
            name: 'Rack',
            cases: ['1', '2'],
            caseCapacities: [6, 1]
        });
        await insertBottles(margaux, [
            { id: 'a', storageCaseId: cases[0].id },
            { id: 'b', storageCaseId: cases[0].id }
        ]);

        expect(moveBottles(['a'], cases[1].id)).toEqual([
            expect.objectContaining({ id: 'a', caseId: cases[1].id })
        ]);
        expect(() => moveBottles(['b'], cases[1].id)).toThrow(
            expect.objectContaining({ code: 'case_full' })
        );
    });
});

describe('changeBottleNotes', () => {
    it('replaces the notes, adds a note after them, or both', async () => {
        await insertBottles(margaux, [
            { id: 'a', notes: 'Old note' },
            { id: 'b', notes: 'Old note' },
            { id: 'c', notes: 'Old note' }
        ]);

        expect(changeBottleNotes(['a'], 'New note', null)[0].notes).toBe('New note');
        expect(changeBottleNotes(['b'], undefined, 'Added')[0].notes).toBe('Old note\nAdded');
        expect(changeBottleNotes(['c'], null, 'Added')[0].notes).toBe('Added');
    });
});

describe('rateWine', () => {
    it('changes the rating of the wine only', () => {
        const before = getDefinitionDetails(barolo);

        expect(rateWine(barolo, 3.5)).toMatchObject({ id: barolo, name: 'Cannubi', rating: 3.5 });
        expect(rateWine(barolo, null).rating).toBeNull();
        expect(getDefinitionDetails(barolo)).toEqual({
            ...before,
            rating: null,
            updatedAt: expect.any(Date)
        });
    });

    it('refuses an unknown wine', () => {
        expect(() => rateWine('nothing', 4)).toThrow(NotFoundError);
    });
});
