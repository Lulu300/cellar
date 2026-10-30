import { describe, expect, it } from 'vitest';
import { priceStats, sortWineGroups, vintageRange, type WineGroupSortKey } from './wine-group-sort';

const available = (vintage: number | null, purchasePrice: number | null) => ({
    availability: 'available',
    vintage,
    purchasePrice
});

// Each group puts its first bottle where a first-bottle sort would misplace it, and owns a
// consumed bottle that would change the oldest vintage and the average price if it counted.
const groups = [
    {
        definition: { name: 'Alpha', producer: 'Zeta', rating: 2 },
        bottles: [available(2020, 10), available(2010, 30)]
    },
    {
        definition: { name: 'bravo', producer: 'Mas Bravo', rating: 5 },
        bottles: [available(2015, 50)]
    },
    {
        definition: { name: 'Charlie', producer: 'Alder', rating: null },
        bottles: [
            { availability: 'consumed', vintage: 1990, purchasePrice: 500 },
            available(2018, 5),
            { availability: 'out_of_cellar', vintage: 2018, purchasePrice: 5 },
            available(2018, 5)
        ]
    },
    {
        definition: { name: 'Delta', producer: '', rating: 0 },
        bottles: [available(null, null)]
    },
    { definition: { name: 'Echo', producer: 'Bravo Caves', rating: 3 }, bottles: [] }
];

const order = (key: WineGroupSortKey, direction: 'asc' | 'desc') =>
    sortWineGroups(groups, key, direction).map((group) => group.definition.name);

describe('sortWineGroups', () => {
    it('sorts by name, ignoring case', () => {
        expect(order('name', 'asc')).toEqual(['Alpha', 'bravo', 'Charlie', 'Delta', 'Echo']);
        expect(order('name', 'desc')).toEqual(['Echo', 'Delta', 'Charlie', 'bravo', 'Alpha']);
    });

    it('sorts by producer, wines without one last', () => {
        expect(order('producer', 'asc')).toEqual(['Charlie', 'Echo', 'bravo', 'Alpha', 'Delta']);
        expect(order('producer', 'desc')).toEqual(['Alpha', 'bravo', 'Echo', 'Charlie', 'Delta']);
    });

    it('sorts by the oldest vintage still owned, not by the first bottle', () => {
        expect(order('vintage', 'asc')).toEqual(['Alpha', 'bravo', 'Charlie', 'Delta', 'Echo']);
        expect(order('vintage', 'desc')).toEqual(['Charlie', 'bravo', 'Alpha', 'Delta', 'Echo']);
    });

    it('sorts by the average price of the bottles still owned, not by the first bottle', () => {
        expect(order('price', 'asc')).toEqual(['Charlie', 'Alpha', 'bravo', 'Delta', 'Echo']);
        expect(order('price', 'desc')).toEqual(['bravo', 'Alpha', 'Charlie', 'Delta', 'Echo']);
    });

    it('sorts by rating, unrated wines last', () => {
        expect(order('rating', 'asc')).toEqual(['Alpha', 'Echo', 'bravo', 'Charlie', 'Delta']);
        expect(order('rating', 'desc')).toEqual(['bravo', 'Echo', 'Alpha', 'Charlie', 'Delta']);
    });

    it('sorts by the number of bottles still owned, then by name', () => {
        expect(order('bottles', 'asc')).toEqual(['Echo', 'bravo', 'Delta', 'Alpha', 'Charlie']);
        expect(order('bottles', 'desc')).toEqual(['Charlie', 'Alpha', 'bravo', 'Delta', 'Echo']);
    });

    it('treats a price of 0 as no price', () => {
        const free = { definition: { name: 'Free' }, bottles: [available(2020, 0)] };
        const mixed = {
            definition: { name: 'Mixed' },
            bottles: [available(2020, 0), available(2020, 30)]
        };
        expect(priceStats(free.bottles)).toBeNull();
        expect(priceStats(mixed.bottles)).toEqual({ min: 30, max: 30, avg: 30 });
        const byPrice = (direction: 'asc' | 'desc') =>
            sortWineGroups([free, mixed, groups[0]], 'price', direction).map(
                (group) => group.definition.name
            );
        expect(byPrice('asc')).toEqual(['Alpha', 'Mixed', 'Free']);
        expect(byPrice('desc')).toEqual(['Mixed', 'Alpha', 'Free']);
    });

    it('does not reorder the list it is given', () => {
        sortWineGroups(groups, 'name', 'desc');
        expect(groups.map((group) => group.definition.name)).toEqual([
            'Alpha',
            'bravo',
            'Charlie',
            'Delta',
            'Echo'
        ]);
    });
});

describe('group aggregates', () => {
    it('ignore consumed bottles and bottles without a value', () => {
        expect(vintageRange(groups[2].bottles)).toEqual({ oldest: 2018, newest: 2018 });
        expect(priceStats(groups[2].bottles)).toEqual({ min: 5, max: 5, avg: 5 });
        expect(vintageRange(groups[3].bottles)).toBeNull();
        expect(priceStats(groups[3].bottles)).toBeNull();
    });

    it('span every bottle still owned', () => {
        expect(vintageRange(groups[0].bottles)).toEqual({ oldest: 2010, newest: 2020 });
        expect(priceStats(groups[0].bottles)).toEqual({ min: 10, max: 30, avg: 20 });
    });
});
