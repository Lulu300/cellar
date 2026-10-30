import { describe, expect, it } from 'vitest';
import { clampPage, pageNumbers, withQuery } from './pagination';

describe('pageNumbers', () => {
    it('lists every page when there are five or fewer', () => {
        expect(pageNumbers(1, 1)).toEqual([1]);
        expect(pageNumbers(3, 4)).toEqual([1, 2, 3, 4]);
    });

    it('keeps the current page in the middle of five', () => {
        expect(pageNumbers(6, 10)).toEqual([4, 5, 6, 7, 8]);
    });

    it('stops at the first and the last page', () => {
        expect(pageNumbers(2, 10)).toEqual([1, 2, 3, 4, 5]);
        expect(pageNumbers(9, 10)).toEqual([6, 7, 8, 9, 10]);
    });
});

describe('withQuery', () => {
    it('sets and removes parameters, keeping the others', () => {
        const url = new URL('http://cellar.test/out-of-cellar?sort=barcode&page=3');
        expect(withQuery(url, { dir: 'asc', page: null }).search).toBe('?sort=barcode&dir=asc');
        expect(url.search).toBe('?sort=barcode&page=3');
    });
});

describe('clampPage', () => {
    it('keeps a page that still exists, or goes back to the last one', () => {
        expect(clampPage(2, 120, 50)).toBe(2);
        expect(clampPage(3, 60, 50)).toBe(2);
        expect(clampPage(2, 0, 50)).toBe(1);
    });
});
