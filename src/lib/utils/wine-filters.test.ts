import { describe, expect, it } from 'vitest';
import {
    filterWines,
    matchesBottleCount,
    matchesOrigin,
    matchesVintage,
    readWineListQuery,
    wineListParams
} from './wine-filters';

const owned = (vintage: number | null, originId = 'cellar-shop') => ({
    availability: 'available',
    vintage,
    origin: { id: originId }
});
const consumed = (vintage: number | null, originId = 'cellar-shop') => ({
    ...owned(vintage, originId),
    availability: 'consumed'
});

describe('the filters of the wine list', () => {
    it('match a vintage only on a bottle still owned', () => {
        const bottles = [owned(2015), consumed(2010)];
        expect(matchesVintage(bottles, 'range', 2014, 2016)).toBe(true);
        expect(matchesVintage(bottles, 'range', 2009, 2011)).toBe(false);
        expect(matchesVintage([owned(2015), consumed(null)], 'no_vintage', null, null)).toBe(false);
    });

    it('leave an open range bound open', () => {
        expect(matchesVintage([owned(2015)], 'range', null, 2016)).toBe(true);
        expect(matchesVintage([owned(2015)], 'range', 2016, null)).toBe(false);
        expect(matchesVintage([owned(null)], 'range', null, null)).toBe(true);
    });

    it('match an origin on any bottle still owned, not only the first one', () => {
        const bottles = [owned(2015, 'market'), owned(2016, 'auction'), consumed(2017, 'gift')];
        expect(matchesOrigin(bottles, 'auction')).toBe(true);
        expect(matchesOrigin(bottles, 'gift')).toBe(false);
    });

    it('count only the bottles still owned', () => {
        const bottles = [owned(2015), consumed(2010), consumed(2011)];
        expect(matchesBottleCount(bottles, 'exact', 1)).toBe(true);
        expect(matchesBottleCount(bottles, 'at_least', 2)).toBe(false);
        expect(matchesBottleCount([consumed(2010)], 'none', 0)).toBe(true);
    });
});

describe('the URL of the wine list', () => {
    it('gives each missing or invalid value its default', () => {
        const query = readWineListQuery(
            new URLSearchParams('search=Bug04&region=r1&sort=nowhere&dir=up&vintage=old&view=grid')
        );
        expect(query).toMatchObject({ search: 'Bug04', region: 'r1', vintage: '', count: '1' });
        expect(query).toMatchObject({ sort: 'name', dir: 'asc', view: '' });
        expect(
            readWineListQuery(new URLSearchParams('sort=price&dir=desc&view=list'))
        ).toMatchObject({ sort: 'price', dir: 'desc', view: 'list' });
    });

    it('leaves out of the URL a value back to its default', () => {
        expect(wineListParams({ search: 'Bug04', type: '', sort: 'name', dir: 'desc' })).toEqual({
            search: 'Bug04',
            type: null,
            sort: null,
            dir: 'desc'
        });
    });
});

describe('filterWines', () => {
    const wine = (id: string, regionId: string, countryId: string, fields = {}) => ({
        definition: {
            id,
            name: `Wine ${id}`,
            producer: null,
            appellationName: 'Somewhere',
            typeId: 'still',
            colorId: 'red',
            appellation: { regionId, region: { countryId } },
            ...fields
        },
        bottles: [owned(2015)]
    });
    // Two regions of the same name, Bourgogne, in two countries
    const wines = [wine('french', 'bourgogne-fr', 'fr'), wine('other', 'bourgogne-xx', 'xx')];
    const ids = (query: string) =>
        filterWines(wines, readWineListQuery(new URLSearchParams(query))).map(
            (shown) => shown.definition.id
        );

    it('tells apart two regions of the same name, and their countries, by their ids', () => {
        expect(ids('region=bourgogne-fr')).toEqual(['french']);
        expect(ids('region=bourgogne-xx')).toEqual(['other']);
        expect(ids('country=xx')).toEqual(['other']);
        expect(ids('')).toEqual(['french', 'other']);
    });

    it('searches the name, the producer and the appellation, in any case', () => {
        const searched = [
            wine('a', 'r', 'c', { name: 'Bug04 Wine' }),
            wine('b', 'r', 'c', { producer: 'Maison BUG04' }),
            wine('c', 'r', 'c')
        ];
        const query = readWineListQuery(new URLSearchParams('search=bug04'));
        expect(filterWines(searched, query).map((shown) => shown.definition.id)).toEqual([
            'a',
            'b'
        ]);
    });

    it('combines the filters', () => {
        expect(ids('country=fr&type=still&bottles=exact&count=1')).toEqual(['french']);
        expect(ids('country=fr&vintage=range&from=2016')).toEqual([]);
    });
});
