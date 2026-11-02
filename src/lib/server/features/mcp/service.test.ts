import { beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
    appellations,
    countries,
    regions,
    storageCases,
    storageContainers,
    wineBottles,
    wineDefinitions,
    wishes
} from '#lib/server/db/schema.js';
import { listBottlesWithDefinitions } from '#lib/server/features/bottles/service.js';
import { getDefinitionDetails } from '#lib/server/features/catalog/service.js';
import { createContainer } from '#lib/server/features/storage/service.js';
import { NotFoundError } from '#lib/server/http/errors.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { insertBottles, insertWineDefinition } from '../../../../test/wine';
import {
    addBottles,
    addWine,
    bottlesByBarcode,
    changeBottleNotes,
    choices,
    deleteBottles,
    editBottles,
    editWine,
    editWish,
    freeSpace,
    listBottles,
    markDrunk,
    moveBottles,
    addWish,
    putBack,
    rateWine,
    removeWishById,
    searchAppellations,
    searchWines,
    takeOut,
    wineShortages,
    wineWithBottles,
    wishlist
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

const search = (
    query?: string,
    fields: { inCellarOnly?: boolean; limit?: number; offset?: number } = {}
) => searchWines({ query, inCellarOnly: false, limit: 50, ...fields });

/** The fields of `object` among `keys` that it has. */
const pick = (object: object, keys: string[]) =>
    Object.fromEntries(Object.entries(object).filter(([key]) => keys.includes(key)));

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

    it('returns at most `limit` wines from `offset`, and counts them all', () => {
        expect(search(undefined, { limit: 1 })).toMatchObject({
            total: 2,
            wines: [{ name: 'Cannubi' }]
        });
        expect(search(undefined, { limit: 1, offset: 1 })).toMatchObject({
            total: 2,
            wines: [{ name: 'Château Margaux' }]
        });
        expect(search(undefined, { offset: 2 })).toEqual({ total: 2, wines: [] });
    });
});

describe('wineWithBottles', () => {
    it('gives the bottles still owned, with their place, apart from those drunk', async () => {
        const { cases } = createContainer({
            name: 'Column B',
            cases: ['1'],
            caseCapacities: [6]
        });
        const inB1 = { storageCaseId: cases[0].id };
        await insertBottles(margaux, [
            { id: 'here', availability: 'available', ...inB1, vintage: 2015 },
            { id: 'out', availability: 'out_of_cellar', ...inB1, notes: 'Lent' },
            { id: 'nowhere', availability: 'out_of_cellar' },
            {
                id: 'drunk',
                availability: 'consumed',
                ...inB1,
                consumedDate: new Date('2026-09-12T20:00:00Z'),
                notes: 'With roast chicken'
            }
        ]);
        // As the storage page names it.
        const b1 = { container: 'B', case: 'Column B1' };

        const wine = wineWithBottles(margaux);

        expect(wine).toMatchObject({ id: margaux, name: 'Château Margaux', color: 'Red' });
        // Only a bottle in the cellar has a location: the others name the case they left so that
        // an assistant does not look for them there (FEAT-12).
        const places = (bottles: object[]) =>
            bottles.map((bottle) => pick(bottle, ['id', 'location', 'formerLocation']));
        expect(places(wine.bottles)).toEqual([
            { id: 'here', location: b1 },
            { id: 'out', formerLocation: b1 },
            { id: 'nowhere', formerLocation: null }
        ]);
        expect(places(wine.consumed)).toEqual([{ id: 'drunk', formerLocation: b1 }]);
        expect(wine.consumed).toEqual([
            expect.objectContaining({
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

describe('listBottles', () => {
    const day = (text: string) => new Date(text);
    const list = (search: Partial<Parameters<typeof listBottles>[0]> = {}) =>
        listBottles({ limit: 50, ...search });
    const idsOf = ({ bottles }: { bottles: { id: string }[] }) => bottles.map(({ id }) => id);

    beforeEach(async () => {
        await insertBottles(margaux, [
            { id: 'cellar', availability: 'available', purchaseDate: day('2025-03-10') },
            { id: 'out', availability: 'out_of_cellar', purchaseDate: day('2026-01-05') },
            {
                id: 'early',
                availability: 'consumed',
                consumedDate: day('2026-10-31'),
                purchaseDate: day('2024-06-01')
            },
            { id: 'late', availability: 'consumed', consumedDate: day('2026-11-01T20:30:00Z') }
        ]);
        await insertBottles(barolo, [
            { id: 'november', availability: 'consumed', consumedDate: day('2026-11-02') }
        ]);
    });

    it('lists every bottle of the cellar with its wine, the latest drunk first, then the latest bought', () => {
        expect(idsOf(list())).toEqual(['november', 'late', 'early', 'out', 'cellar']);
        expect(list().bottles[0]).toMatchObject({
            id: 'november',
            availability: 'consumed',
            consumedDate: '2026-11-02',
            wine: { id: barolo, name: 'Cannubi', producer: 'Élevage Côté', color: 'Red' }
        });
    });

    it('keeps the bottles of an availability, drunk or bought within the days given, both included', () => {
        const november = { consumedFrom: day('2026-11-01'), consumedTo: day('2026-11-30') };

        expect(idsOf(list({ availability: BottleAvailability.CONSUMED, ...november }))).toEqual([
            'november',
            'late'
        ]);
        expect(idsOf(list({ consumedTo: day('2026-10-31') }))).toEqual(['early']);
        expect(idsOf(list({ purchasedFrom: day('2025-01-01') }))).toEqual(['out', 'cellar']);
        expect(idsOf(list({ availability: BottleAvailability.OUT_OF_CELLAR }))).toEqual(['out']);
    });

    it('returns at most `limit` bottles from `offset`, and counts them all', () => {
        expect(list({ limit: 2 })).toMatchObject({
            total: 5,
            bottles: [{ id: 'november' }, { id: 'late' }]
        });
        expect(idsOf(list({ limit: 2, offset: 2 }))).toEqual(['early', 'out']);
        expect(idsOf(list({ limit: 2, offset: 4 }))).toEqual(['cellar']);
    });

    // "What is in case B2?" (FEAT-04): the bottles a case holds, as the storage page counts them.
    it('lists what a case holds, the bottles out of the cellar that kept it left out', async () => {
        const { cases } = createContainer({ name: 'B', cases: ['1', '2'], caseCapacities: [6, 6] });
        const [b1, b2] = cases.map(({ id }) => id);
        db.update(wineBottles).set({ storageCaseId: b2 }).where(eq(wineBottles.id, 'out')).run();
        await insertBottles(barolo, [
            { id: 'in-b2', availability: 'available', storageCaseId: b2 },
            { id: 'in-b1', availability: 'available', storageCaseId: b1 }
        ]);

        expect(idsOf(list({ caseId: b2 }))).toEqual(['in-b2']);
        expect(list({ caseId: b2 }).bottles[0]).toMatchObject({
            location: { container: 'B', case: 'B2' },
            wine: { name: 'Cannubi' }
        });
        expect(() => list({ caseId: 'no-such-case' })).toThrow(NotFoundError);
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
    it('marks the bottles drunk on the day given, keeping their case, the note after their notes', async () => {
        const { cases } = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [6] });
        await insertBottles(margaux, [
            { id: 'a', storageCaseId: cases[0].id, notes: 'Gift from Anna' },
            { id: 'b', storageCaseId: cases[0].id }
        ]);

        const drunk = markDrunk(['a', 'b'], new Date('2026-10-30'), 'With roast chicken');

        expect(drunk[0]).not.toHaveProperty('caseId');
        // Drunk, they take no room in their case.
        expect(freeSpace().containers[0].cases[0]).toMatchObject({ bottles: 0, free: 6 });
        expect(drunk).toEqual([
            expect.objectContaining({
                id: 'a',
                availability: 'consumed',
                formerCaseId: cases[0].id,
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

describe('takeOut and putBack', () => {
    it('take bottles out keeping their case, and put them back there or in the case given', async () => {
        const { cases } = createContainer({
            name: 'Rack',
            cases: ['1', '2'],
            caseCapacities: [1, 6]
        });
        await insertBottles(margaux, [
            { id: 'a', storageCaseId: cases[0].id },
            { id: 'b', storageCaseId: cases[0].id, availability: 'out_of_cellar' }
        ]);

        expect(takeOut(['a'])).toEqual([
            expect.objectContaining({
                id: 'a',
                availability: 'out_of_cellar',
                formerCaseId: cases[0].id
            })
        ]);
        // Out of the cellar, a bottle takes no room in its case: the other one goes back there.
        expect(putBack(['b'], null)).toEqual([
            expect.objectContaining({ id: 'b', availability: 'available', caseId: cases[0].id })
        ]);
        expect(() => putBack(['a'], null)).toThrow(expect.objectContaining({ code: 'case_full' }));
        expect(putBack(['a'], cases[1].id)).toEqual([
            expect.objectContaining({ id: 'a', availability: 'available', caseId: cases[1].id })
        ]);
    });

    it('undo a drunk made by mistake, without its consumed date', async () => {
        const { cases } = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [6] });
        await insertBottles(margaux, [{ id: 'a' }, { id: 'b' }]);
        markDrunk(['a', 'b'], new Date('2026-10-30'), null);

        const [back] = putBack(['a'], cases[0].id);
        const [out] = takeOut(['b']);

        expect(back).toMatchObject({ availability: 'available', caseId: cases[0].id });
        expect(back).toHaveProperty('consumedDate', null);
        expect(out).toMatchObject({ availability: 'out_of_cellar' });
        expect(out).toHaveProperty('consumedDate', null);
    });

    // FEAT-12: a bottle drunk keeps its case, without taking room there, and goes back to it.
    it('put a bottle drunk by mistake back in its case, or refuse when the case filled up', async () => {
        const { cases } = createContainer({
            name: 'Rack',
            cases: ['1', '2'],
            caseCapacities: [1, 6]
        });
        const [small, large] = cases.map(({ id }) => id);
        await insertBottles(margaux, [
            { id: 'a', storageCaseId: small },
            { id: 'b', storageCaseId: large },
            // Drunk before 1.4.0, when a drunk bottle lost its case.
            { id: 'old', availability: 'consumed', consumedDate: new Date('2025-01-01') }
        ]);
        const counts = () => freeSpace().containers[0].cases.map(({ bottles }) => bottles);
        markDrunk(['a', 'b'], new Date('2026-10-30'), null);
        expect(counts()).toEqual([0, 0]);

        expect(putBack(['b', 'old'], null)).toEqual([
            expect.objectContaining({ id: 'b', availability: 'available', caseId: large }),
            expect.objectContaining({ id: 'old', availability: 'available' })
        ]);
        expect(counts()).toEqual([0, 1]);
        expect(listBottlesWithDefinitions(margaux).find(({ id }) => id === 'old')).toMatchObject({
            storageCaseId: null,
            consumedDate: null
        });

        // The case filled up while the bottle was drunk: it does not come back, nor any other.
        await insertBottles(barolo, [{ id: 'newcomer', storageCaseId: small }]);
        expect(() => putBack(['a'], null)).toThrow(expect.objectContaining({ code: 'case_full' }));
        expect(listBottlesWithDefinitions(margaux).find(({ id }) => id === 'a')).toMatchObject({
            availability: 'consumed',
            storageCaseId: small
        });
        expect(putBack(['a'], large)[0]).toMatchObject({ caseId: large });
    });

    it('change none of the bottles when one does not exist or the case has no room for them', async () => {
        const { cases } = createContainer({ name: 'Rack', cases: ['1'], caseCapacities: [1] });
        await insertBottles(margaux, [
            { id: 'a', availability: 'out_of_cellar' },
            { id: 'b', availability: 'out_of_cellar' }
        ]);

        expect(() => takeOut(['a', 'gone'])).toThrow(NotFoundError);
        expect(() => putBack(['a', 'b'], cases[0].id)).toThrow(
            expect.objectContaining({ code: 'case_full' })
        );
        expect(listBottlesWithDefinitions(margaux).map((bottle) => bottle.availability)).toEqual([
            'out_of_cellar',
            'out_of_cellar'
        ]);
    });
});

describe('editBottles', () => {
    it('gives each bottle the fields given and leaves the others', async () => {
        await insertBottles(margaux, [
            { id: 'a', vintage: 2015, purchasePrice: 30, notes: 'Gift' },
            { id: 'b', vintage: 2016, purchasePrice: 30, barcode: 'CV1' }
        ]);

        const edited = editBottles(['a', 'b'], {
            purchasePrice: 45.5,
            currentValue: 60,
            optimum: 2030,
            purchaseDate: new Date('2026-10-01'),
            barcode: undefined
        });

        expect(edited).toEqual([
            expect.objectContaining({
                id: 'a',
                vintage: 2015,
                optimum: 2030,
                purchasePrice: 45.5,
                purchaseDate: '2026-10-01',
                currentValue: 60,
                notes: 'Gift'
            }),
            expect.objectContaining({ id: 'b', vintage: 2016, barcode: 'CV1' })
        ]);
        expect(editBottles(['a'], { vintage: null, purchasePrice: null })[0]).toMatchObject({
            vintage: null,
            purchasePrice: null
        });
    });

    it('refuses a barcode for several bottles, or one another bottle has, changing none', async () => {
        await insertBottles(margaux, [
            { id: 'a', barcode: 'CV1', purchasePrice: 30 },
            { id: 'b', purchasePrice: 30 }
        ]);

        expect(() => editBottles(['a', 'b'], { barcode: 'CV2' })).toThrow(
            'A barcode can only be given to a single bottle'
        );
        expect(() => editBottles(['b'], { barcode: 'CV1', purchasePrice: 10 })).toThrow(
            /UNIQUE constraint failed: wine_bottles.barcode/
        );
        expect(listBottlesWithDefinitions(margaux).map((bottle) => bottle.purchasePrice)).toEqual([
            30, 30
        ]);
    });
});

describe('deleteBottles', () => {
    it('deletes the bottles, or none when one does not exist', async () => {
        await insertBottles(margaux, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

        expect(() => deleteBottles(['a', 'gone'])).toThrow(NotFoundError);
        expect(listBottlesWithDefinitions(margaux)).toHaveLength(3);
        expect(deleteBottles(['a', 'b', 'a'])).toEqual({ deleted: ['a', 'b'] });
        expect(listBottlesWithDefinitions(margaux).map(({ id }) => id)).toEqual(['c']);
    });
});

describe('editWine', () => {
    it('changes the fields given, clears those given null, and leaves the others', () => {
        const before = getDefinitionDetails(barolo);
        // The other tests read this wine as beforeAll made it: its fields are given back after.
        onTestFinished(() => {
            editWine(barolo, {
                targetQuantity: before.targetQuantity,
                description: null,
                producer: before.producer,
                grapeVarieties: before.grapeVarieties
            });
        });

        const wine = editWine(barolo, {
            targetQuantity: 12,
            description: 'From the Cannubi hill',
            producer: null,
            grapeVarieties: ['Nebbiolo', 'Barbera']
        });

        expect(wine).toMatchObject({
            id: barolo,
            name: 'Cannubi',
            targetQuantity: 12,
            description: 'From the Cannubi hill',
            producer: null,
            grapes: ['Nebbiolo', 'Barbera'],
            bottles: []
        });
        expect(getDefinitionDetails(barolo)).toEqual({
            ...before,
            targetQuantity: 12,
            description: 'From the Cannubi hill',
            producer: null,
            grapeVarieties: ['Nebbiolo', 'Barbera'],
            updatedAt: expect.any(Date)
        });
    });

    it('refuses an unknown wine', () => {
        expect(() => editWine('nothing', { targetQuantity: 1 })).toThrow(NotFoundError);
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

describe('the wishlist', () => {
    beforeEach(() => {
        db.delete(wishes).run();
    });

    it('lists the wines and the texts to buy, the newest first, without photos', async () => {
        await insertBottles(margaux, [{ availability: 'available' }, { availability: 'consumed' }]);
        const wine = addWish({ definitionId: margaux, text: null, quantity: 6, note: null });
        const text = addWish({
            definitionId: null,
            text: 'Clos Rougeard',
            quantity: null,
            note: 'Saumur'
        });

        expect(wishlist()).toEqual([
            { id: text.id, text: 'Clos Rougeard', quantity: null, note: 'Saumur', wine: null },
            {
                id: wine.id,
                text: null,
                quantity: 6,
                note: null,
                wine: {
                    id: margaux,
                    name: 'Château Margaux',
                    producer: null,
                    color: 'Red',
                    type: 'Still',
                    appellation: 'Margaux',
                    region: 'Bordeaux',
                    country: 'France',
                    inCellar: 1
                }
            }
        ]);
    });

    it('changes the quantity or the note of a wish, and leaves the rest', () => {
        const wish = addWish({
            definitionId: null,
            text: 'Clos Rougeard',
            quantity: 2,
            note: 'Saumur'
        });

        expect(editWish(wish.id, { quantity: 6 })).toEqual({ ...wish, quantity: 6 });
        expect(editWish(wish.id, { note: null })).toEqual({ ...wish, quantity: 6, note: null });
        expect(() => editWish('nothing', { quantity: 1 })).toThrow('Wish not found');
    });

    it('refuses a wine twice, and removes a wish', async () => {
        const wish = addWish({ definitionId: margaux, text: null, quantity: null, note: null });

        expect(() =>
            addWish({ definitionId: margaux, text: null, quantity: 2, note: null })
        ).toThrow('This wine is already on the wishlist');
        expect(await removeWishById(wish.id)).toEqual({ removed: wish.id });
        expect(wishlist()).toEqual([]);
        await expect(removeWishById(wish.id)).rejects.toThrow('Wish not found');
    });
});
