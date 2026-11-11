import { describe, expect, it } from 'vitest';
import { parsePageQuery } from './bottle-list';

const columns = ['definition', 'purchaseDate', 'barcode'] as const;
const parse = (query: string) =>
    parsePageQuery(new URLSearchParams(query), columns, 'purchaseDate');

describe('parsePageQuery', () => {
    it('reads the sort, the direction, the page and the page size', () => {
        expect(parse('sort=barcode&dir=desc&page=3&perPage=25')).toEqual({
            sort: 'barcode',
            direction: 'desc',
            page: 3,
            perPage: 25
        });
    });

    it('gives the defaults for a missing query, a date sorting the newest first', () => {
        expect(parse('')).toEqual({
            sort: 'purchaseDate',
            direction: 'desc',
            page: 1,
            perPage: 50
        });
        expect(parse('sort=definition')).toMatchObject({ sort: 'definition', direction: 'asc' });
    });

    it('replaces each invalid value with its default rather than failing', () => {
        expect(parse('sort=notes&dir=up&page=-2&perPage=1000')).toEqual({
            sort: 'purchaseDate',
            direction: 'desc',
            page: 1,
            perPage: 50
        });
        expect(parse('page=1.5&perPage=abc')).toMatchObject({ page: 1, perPage: 50 });
    });

    it('accepts only the columns that the table shows', () => {
        // availability is a column of another table
        expect(parse('sort=availability').sort).toBe('purchaseDate');
    });

    it('gives the default sort its own direction when the column asked is not shown', () => {
        // The consumption date of the history, kept in the URL on a list that has no such column
        expect(parse('sort=consumedDate&dir=asc')).toMatchObject({
            sort: 'purchaseDate',
            direction: 'desc'
        });
    });
});
