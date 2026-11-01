import { describe, expect, it } from 'vitest';
import { sortBottles, type TableBottle } from './bottle-sort';

function bottle(id: string, fields: Partial<TableBottle> = {}): TableBottle {
    return {
        id,
        availability: 'available',
        vintage: null,
        format: null,
        purchaseDate: null,
        purchasePrice: null,
        barcode: null,
        notes: null,
        ...fields
    };
}

const ids = (bottles: TableBottle[]) => bottles.map((b) => b.id);

describe('sortBottles', () => {
    const named = (id: string, name: string) =>
        bottle(id, { definition: { id, name, producer: null, color: 'Red', colorHex: '#7b1e2b' } });

    it('sorts names by the rules of the language, not by character codes', () => {
        const bottles = [named('z', 'Zéphyr'), named('e', 'étoile'), named('c', 'Château')];
        expect(ids(sortBottles(bottles, { column: 'definition', direction: 'asc' }))).toEqual([
            'c',
            'e',
            'z'
        ]);
        expect(ids(sortBottles(bottles, { column: 'definition', direction: 'desc' }))).toEqual([
            'z',
            'e',
            'c'
        ]);
    });

    it('puts the bottles without a value last in both directions', () => {
        const bottles = [
            bottle('none', { purchasePrice: null }),
            bottle('cheap', { purchasePrice: 8 }),
            bottle('dear', { purchasePrice: 40 })
        ];
        expect(ids(sortBottles(bottles, { column: 'purchasePrice', direction: 'asc' }))).toEqual([
            'cheap',
            'dear',
            'none'
        ]);
        expect(ids(sortBottles(bottles, { column: 'purchasePrice', direction: 'desc' }))).toEqual([
            'dear',
            'cheap',
            'none'
        ]);
    });

    it('sorts dates, given as Dates or as JSON strings, by time', () => {
        const bottles = [
            bottle('old', { purchaseDate: '2019-05-01T00:00:00.000Z' }),
            bottle('new', { purchaseDate: new Date('2024-02-01') }),
            bottle('none')
        ];
        expect(ids(sortBottles(bottles, { column: 'purchaseDate', direction: 'desc' }))).toEqual([
            'new',
            'old',
            'none'
        ]);
    });

    it('leaves the list it is given as it is', () => {
        const bottles = [bottle('b', { vintage: 2020 }), bottle('a', { vintage: 2010 })];
        sortBottles(bottles, { column: 'vintage', direction: 'asc' });
        expect(ids(bottles)).toEqual(['b', 'a']);
    });
});
