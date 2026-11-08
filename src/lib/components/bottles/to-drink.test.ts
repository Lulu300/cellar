import { describe, expect, it } from 'vitest';
import type { DrinkingRank } from '#lib/shared/drinking.js';
import {
    filterChoices,
    filterToDrink,
    groupByWine,
    readToDrinkQuery,
    type ToDrinkBottle
} from './to-drink';

const red = { colorId: 'red', color: 'Rouge', colorHex: '#7b1e2b' };
const white = { colorId: 'white', color: 'Blanc', colorHex: '#ead98b' };

function bottle(
    id: string,
    rank: DrinkingRank,
    wine: { id: string; name: string; producer?: string },
    fields: Partial<ToDrinkBottle> & { color?: typeof red } = {}
): ToDrinkBottle {
    const { color = red, ...rest } = fields;
    return {
        id,
        vintage: 2015,
        rank,
        storageCase: null,
        definition: { id: wine.id, name: wine.name, producer: wine.producer ?? null, ...color },
        ...rest
    };
}

const margaux = { id: 'margaux', name: 'Château Margaux', producer: 'Margaux SA' };
const meursault = { id: 'meursault', name: 'Meursault', producer: 'Domaine Roulot' };
const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('readToDrinkQuery', () => {
    const read = (query: string) => readToDrinkQuery(new URLSearchParams(query));

    it('shows every bottle by urgency, one per row, by default', () => {
        expect(read('')).toEqual({
            view: 'bottle',
            rank: '',
            color: '',
            search: '',
            sort: 'urgency',
            direction: 'asc',
            page: 1,
            perPage: 50
        });
    });

    it('reads the view, the filters and the sort', () => {
        expect(
            read('view=wine&rank=late&color=red&search=mar&sort=optimum&dir=desc&page=2')
        ).toMatchObject({
            view: 'wine',
            rank: 'late',
            color: 'red',
            search: 'mar',
            sort: 'optimum',
            direction: 'desc',
            page: 2
        });
    });

    it('falls back to the defaults on values it does not know', () => {
        expect(read('view=grid&rank=later&sort=price')).toMatchObject({
            view: 'bottle',
            rank: '',
            sort: 'urgency'
        });
    });
});

describe('filterToDrink', () => {
    const bottles = [
        bottle('a', 'late', margaux),
        bottle('b', 'optimum_reached', margaux),
        bottle('c', 'late', meursault, { color: white })
    ];

    it('keeps the bottles of the rank and colour chosen', () => {
        expect(ids(filterToDrink(bottles, { rank: 'late', color: '', search: '' }))).toEqual([
            'a',
            'c'
        ]);
        expect(ids(filterToDrink(bottles, { rank: 'late', color: 'red', search: '' }))).toEqual([
            'a'
        ]);
    });

    it('finds the wine by its name or its producer, capitals aside', () => {
        const search = (text: string) =>
            ids(filterToDrink(bottles, { rank: '', color: '', search: text }));
        expect(search(' MARGAUX ')).toEqual(['a', 'b']);
        expect(search('roulot')).toEqual(['c']);
        expect(search('pétrus')).toEqual([]);
    });
});

describe('filterChoices', () => {
    const bottles = [
        bottle('a', 'late', margaux),
        bottle('b', 'optimum_reached', margaux),
        bottle('c', 'late', meursault, { color: white }),
        bottle('d', 'this_month', meursault, { color: white })
    ];

    it('offers the ranks of the list, the most urgent first, and its colours by name', () => {
        const choices = filterChoices(bottles, { rank: '', color: '', search: '' });
        expect(choices.ranks).toEqual([
            { value: 'late', count: 2 },
            { value: 'this_month', count: 1 },
            { value: 'optimum_reached', count: 1 }
        ]);
        expect(choices.colors).toEqual([
            { value: 'white', count: 2 },
            { value: 'red', count: 2 }
        ]);
    });

    it('counts each choice within the other filters, its own left aside', () => {
        const choices = filterChoices(bottles, { rank: 'late', color: 'red', search: '' });
        expect(choices.ranks).toEqual([
            { value: 'late', count: 1 },
            { value: 'this_month', count: 0 },
            { value: 'optimum_reached', count: 1 }
        ]);
        expect(choices.colors).toEqual([
            { value: 'white', count: 1 },
            { value: 'red', count: 1 }
        ]);
    });
});

describe('groupByWine', () => {
    it('puts the bottles of one wine and vintage on one row, in the order of the list', () => {
        const rows = groupByWine([
            bottle('a', 'late', margaux, { storageCase: { name: 'B2' } }),
            bottle('b', 'late', meursault),
            bottle('c', 'optimum_reached', margaux, { storageCase: { name: 'A1' } }),
            bottle('d', 'optimum_reached', margaux, { vintage: 2016 }),
            bottle('e', 'optimum_reached', margaux, { storageCase: { name: 'B2' } })
        ]);

        expect(rows.map(({ id, count }) => [id, count])).toEqual([
            ['margaux:2015', 3],
            ['meursault:2015', 1],
            ['margaux:2016', 1]
        ]);
        expect(ids(rows[0].bottles)).toEqual(['a', 'c', 'e']);
    });

    it('gives a row the rank of its most urgent bottle and names each of its cases once', () => {
        const [row] = groupByWine([
            bottle('a', 'this_month', margaux, { storageCase: { name: 'B2' } }),
            bottle('b', 'optimum_reached', margaux, { storageCase: { name: 'A1' } }),
            bottle('c', 'optimum_reached', margaux),
            bottle('d', 'optimum_reached', margaux, { storageCase: { name: 'B2' } })
        ]);

        expect(row.rank).toBe('this_month');
        expect(row.storageCase).toEqual({ name: 'B2, A1' });
    });

    it('names the first two cases of a row, then how many others', () => {
        const inCase = (id: string, name: string) =>
            bottle(id, 'optimum_reached', margaux, { storageCase: { name } });
        const [row] = groupByWine([
            inCase('a', 'Cave1'),
            inCase('b', 'Cave4'),
            inCase('c', 'Cave1'),
            inCase('d', 'Frigo2'),
            inCase('e', 'Cave7')
        ]);

        expect(row.storageCase).toEqual({ name: 'Cave1, Cave4 +2' });
    });

    it('keeps a wine without vintage apart from its vintages', () => {
        const rows = groupByWine([
            bottle('a', 'late', margaux, { vintage: null }),
            bottle('b', 'late', margaux)
        ]);
        expect(rows.map((row) => row.count)).toEqual([1, 1]);
    });
});
