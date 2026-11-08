import { afterEach, describe, expect, it, vi } from 'vitest';
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

    describe('on when to drink', () => {
        afterEach(() => vi.useRealTimers());

        it('sorts by urgency in the month of the browser, as the banner orders them', () => {
            vi.useFakeTimers({ now: new Date(2026, 10, 15), toFake: ['Date'] });
            const bottles = [
                bottle('optimum', { optimum: 2010 }),
                bottle('none'),
                bottle('this-month', { drinkBefore: '2026-11' }),
                bottle('late', { drinkBefore: '2026-10' }),
                bottle('later', { drinkBefore: '2027' })
            ];
            expect(ids(sortBottles(bottles, { column: 'urgency', direction: 'asc' }))).toEqual([
                'late',
                'this-month',
                'optimum',
                'later',
                'none'
            ]);
        });

        it('sorts by optimum, the oldest first, and by « drink before », a year alone as its December', () => {
            const bottles = [
                bottle('year', { drinkBefore: '2026', optimum: 2030 }),
                bottle('none'),
                bottle('month', { drinkBefore: '2026-06', optimum: 2001 }),
                bottle('earlier', { drinkBefore: '2025-03', optimum: 2015 })
            ];
            expect(ids(sortBottles(bottles, { column: 'optimum', direction: 'asc' }))).toEqual([
                'month',
                'earlier',
                'year',
                'none'
            ]);
            expect(ids(sortBottles(bottles, { column: 'drinkBefore', direction: 'asc' }))).toEqual([
                'earlier',
                'month',
                'year',
                'none'
            ]);
        });

        it('sorts by the colour of the wine', () => {
            const colored = (id: string, color: string) =>
                bottle(id, {
                    definition: { id, name: id, producer: null, color, colorHex: '#000' }
                });
            const bottles = [colored('r', 'Rouge'), colored('b', 'Blanc'), colored('o', 'Orange')];
            expect(ids(sortBottles(bottles, { column: 'color', direction: 'asc' }))).toEqual([
                'b',
                'o',
                'r'
            ]);
        });
    });
});
