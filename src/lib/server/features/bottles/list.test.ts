import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import {
    createBottles,
    listBottlePage,
    listBottlesToDrink,
    listBottlesWithDefinitions,
    updateBottles
} from './service';

const { AVAILABLE, OUT_OF_CELLAR, CONSUMED } = BottleAvailability;

let margaux: string;
const otherWine = 'angelus';

beforeAll(async () => {
    margaux = await insertWineDefinition();
    const now = new Date();
    const wine = (id: string, name: string) => ({
        id,
        name,
        appellationId: 'mgx',
        typeId: 'still',
        colorId: 'red',
        createdAt: now,
        updatedAt: now
    });
    await db
        .insert(wineDefinitions)
        .values([
            wine(otherWine, 'Angélus'),
            wine('emile', 'émile'),
            wine('zoe', 'Zoé'),
            wine('eric', 'Éric')
        ]);
});

beforeEach(async () => {
    await db.delete(wineBottles);
});

function addBottle(fields: Record<string, unknown> = {}, definitionId = margaux) {
    return createBottles(bottleData(definitionId, fields), 1)[0];
}

const ids = (bottles: { id: string }[]) => bottles.map((bottle) => bottle.id);

const firstPage = {
    availabilities: [AVAILABLE, OUT_OF_CELLAR, CONSUMED],
    sort: 'purchaseDate' as const,
    direction: 'desc' as const,
    page: 1,
    perPage: 50
};

describe('listBottlePage', () => {
    it('lists only the bottles of the availabilities asked, with how many there are', () => {
        const out = addBottle({ availability: OUT_OF_CELLAR });
        addBottle();
        addBottle({ availability: CONSUMED, consumedDate: '2024-05-01' });

        const page = listBottlePage({ ...firstPage, availabilities: [OUT_OF_CELLAR] });

        expect(ids(page.bottles)).toEqual([out.id]);
        expect(page).toMatchObject({ total: 1, page: 1, pageCount: 1 });
        expect(page.bottles[0]).toMatchObject({
            format: 'Bottle',
            definition: { name: 'Château Margaux', type: 'Still', color: 'Red' }
        });
    });

    it('sorts on the column asked, a missing value last in both directions', () => {
        const cheap = addBottle({ purchasePrice: 10 });
        const dear = addBottle({ purchasePrice: 90 });
        const unknown = addBottle({ purchasePrice: null });

        const sorted = (direction: 'asc' | 'desc') =>
            ids(listBottlePage({ ...firstPage, sort: 'purchasePrice', direction }).bottles);

        expect(sorted('asc')).toEqual([cheap.id, dear.id, unknown.id]);
        expect(sorted('desc')).toEqual([dear.id, cheap.id, unknown.id]);
    });

    it('sorts on the name of the wine', () => {
        const margauxBottle = addBottle();
        const angelusBottle = addBottle({}, otherWine);

        const page = listBottlePage({ ...firstPage, sort: 'definition', direction: 'asc' });

        expect(ids(page.bottles)).toEqual([angelusBottle.id, margauxBottle.id]);
    });

    it('sorts text by the rules of the language, whatever the capitals and accents', () => {
        const zoe = addBottle({}, 'zoe');
        const emile = addBottle({}, 'emile');
        const eric = addBottle({}, 'eric');

        const page = listBottlePage({ ...firstPage, sort: 'definition', direction: 'asc' });

        expect(ids(page.bottles)).toEqual([emile.id, eric.id, zoe.id]);
    });

    it('shows each bottle on one page only, even when they sort the same', () => {
        const all = createBottles(bottleData(margaux, { purchasePrice: 20 }), 7);
        const pageOf = (page: number) =>
            listBottlePage({ ...firstPage, sort: 'purchasePrice', page, perPage: 3 });

        const pages = [1, 2, 3].map(pageOf);

        expect(pages.map((page) => page.bottles.length)).toEqual([3, 3, 1]);
        expect(pages.flatMap((page) => ids(page.bottles)).sort()).toEqual(ids(all).sort());
        expect(pages[0]).toMatchObject({ total: 7, pageCount: 3 });
    });

    it('gives the last page for a page past it', () => {
        createBottles(bottleData(margaux), 3);

        const page = listBottlePage({ ...firstPage, page: 9, perPage: 2 });

        expect(page).toMatchObject({ page: 2, pageCount: 2 });
        expect(page.bottles).toHaveLength(1);
    });

    it('gives one empty page when there is no bottle', () => {
        expect(listBottlePage(firstPage)).toEqual({ bottles: [], total: 0, page: 1, pageCount: 1 });
    });
});

describe('listBottlesWithDefinitions', () => {
    it('lists the bottles of one wine only when asked', () => {
        const margauxBottle = addBottle();
        const angelusBottle = addBottle({}, otherWine);

        expect(ids(listBottlesWithDefinitions(otherWine))).toEqual([angelusBottle.id]);
        expect(ids(listBottlesWithDefinitions()).sort()).toEqual(
            [margauxBottle.id, angelusBottle.id].sort()
        );
    });
});

describe('listBottlesToDrink', () => {
    const november = { year: 2026, month: 11 };
    const toDrink = () => listBottlesToDrink(november);

    it('lists the bottles to drink soon in the order of the rule, with their rank', () => {
        const later = addBottle({ drinkBefore: '2027-01' });
        const optimum = addBottle({ optimum: 2025 });
        const thisYear = addBottle({ drinkBefore: '2026' });
        const thisMonth = addBottle({ drinkBefore: '2026-11' });
        const late = addBottle({ drinkBefore: '2026-09', optimum: 2030 });
        addBottle();

        expect(toDrink().map(({ id, rank }) => [id, rank])).toEqual([
            [late.id, 'late'],
            [thisMonth.id, 'this_month'],
            [thisYear.id, 'this_year'],
            [optimum.id, 'optimum_reached']
        ]);
        expect(ids(toDrink())).not.toContain(later.id);
        expect(toDrink()[0]).toMatchObject({ definition: { name: 'Château Margaux' } });
    });

    it('breaks a tie by wine, then vintage, then id', () => {
        const margaux2015 = addBottle({ drinkBefore: '2026', vintage: 2015 });
        const margaux2010 = addBottle({ drinkBefore: '2026-12', vintage: 2010 });
        const angelus = addBottle({ drinkBefore: '2026' }, otherWine);
        const twins = createBottles(bottleData(margaux, { drinkBefore: '2026', vintage: 2015 }), 2);

        expect(ids(toDrink())).toEqual([
            angelus.id,
            margaux2010.id,
            ...[margaux2015.id, ...ids(twins)].sort()
        ]);
    });

    it('leaves out a bottle drunk or taken out, which keeps its date', () => {
        const drunk = addBottle({ drinkBefore: '2026-11' });
        const out = addBottle({ drinkBefore: '2026-11' });
        const kept = addBottle({ drinkBefore: '2026-11' });

        const [consumed] = updateBottles([drunk.id], { availability: CONSUMED });
        updateBottles([out.id], { availability: OUT_OF_CELLAR });

        expect(ids(toDrink())).toEqual([kept.id]);
        expect(consumed.drinkBefore).toBe('2026-11');
    });
});
